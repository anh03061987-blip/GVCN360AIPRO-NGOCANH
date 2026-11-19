import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth, type DecodedIdToken } from 'firebase-admin/auth';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const PRIMARY_ADMIN_EMAIL = 'anh03061987@gmail.com';

// Initialize Firebase Admin Auth ONLY for cryptographic ID token verification (requires zero IAM)
const adminApp = getApps().length
  ? getApp()
  : initializeApp({ projectId: firebaseConfig.projectId });
const adminAuth = getAdminAuth(adminApp);

interface AuthenticatedRequest extends Request {
  authUser?: {
    uid: string;
    email: string;
    emailVerified: boolean;
    isPrimaryAdmin: boolean;
    token: string;
    decoded: DecodedIdToken;
  };
}

app.use(express.json({ limit: '1mb' }));

// Prevent caching of any API response
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  next();
});

async function checkTeacherApprovedViaFirestoreRest(
  uid: string,
  idToken: string
): Promise<{ approved: boolean; status: string }> {
  const dbId = encodeURIComponent(firebaseConfig.firestoreDatabaseId || '(default)');
  const safeUid = encodeURIComponent(uid);
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    firebaseConfig.projectId
  )}/databases/${dbId}/documents/teacher_access_requests/${safeUid}`;

  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
      Accept: 'application/json',
    },
  });

  if (resp.status === 404) {
    return { approved: false, status: 'unregistered' };
  }
  if (!resp.ok) {
    return { approved: false, status: 'denied' };
  }

  const data = (await resp.json()) as {
    fields?: {
      status?: { stringValue?: string };
    };
  };
  const status = data.fields?.status?.stringValue || 'pending';
  return { approved: status === 'approved', status };
}

async function requireApprovedTeacher(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Yêu cầu đăng nhập tài khoản Giáo viên hợp lệ để sử dụng chức năng này.',
        code: 'UNAUTHENTICATED',
      });
      return;
    }

    const idToken = authHeader.slice(7).trim();
    if (!idToken) {
      res.status(401).json({
        error: 'Thiếu mã xác thực phiên đăng nhập.',
        code: 'UNAUTHENTICATED',
      });
      return;
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const email = (decoded.email || '').trim().toLowerCase();
    const emailVerified = decoded.email_verified === true;

    if (!email || !emailVerified) {
      res.status(403).json({
        error: 'Tài khoản chưa xác minh email hoặc không có quyền truy cập API Giáo viên.',
        code: 'EMAIL_NOT_VERIFIED',
      });
      return;
    }

    const isPrimaryAdmin = email === PRIMARY_ADMIN_EMAIL;
    if (!isPrimaryAdmin) {
      const approval = await checkTeacherApprovedViaFirestoreRest(decoded.uid, idToken);
      if (!approval.approved) {
        res.status(403).json({
          error: 'Tài khoản của bạn đang chờ quản trị viên phê duyệt quyền Giáo viên.',
          code: 'TEACHER_PENDING_APPROVAL',
          status: approval.status,
        });
        return;
      }
    }

    req.authUser = {
      uid: decoded.uid,
      email,
      emailVerified,
      isPrimaryAdmin,
      token: idToken,
      decoded,
    };
    next();
  } catch (error) {
    console.error('Auth verification failed:', error instanceof Error ? error.message : 'Invalid token');
    res.status(401).json({
      error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
      code: 'INVALID_TOKEN',
    });
  }
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// ============================================================================
// AUTH VERIFICATION ENDPOINT (Protected)
// ============================================================================
app.get('/api/auth/verify', requireApprovedTeacher, (req: AuthenticatedRequest, res) => {
  res.json({
    authenticated: true,
    approved: true,
    uid: req.authUser?.uid,
    email: req.authUser?.email,
    isPrimaryAdmin: req.authUser?.isPrimaryAdmin === true,
  });
});

// ============================================================================
// SERVER-SIDE GEMINI API ROUTES (GVCN 360 AI PRO — Strictly Protected)
// ============================================================================
app.post('/api/gemini/analyze', requireApprovedTeacher, async (req: AuthenticatedRequest, res) => {
  try {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ. Vui lòng thiết lập khóa trong Settings > Secrets.',
      });
      return;
    }

    const { prompt } = req.body as { prompt?: string };
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Thiếu nội dung dữ liệu đầu vào để phân tích.' });
      return;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'Bạn là chuyên gia tư vấn sư phạm cho Giáo viên Chủ nhiệm THPT tại Việt Nam. Chỉ phân tích dựa trên dữ liệu đã xác nhận được cung cấp, tuyệt đối không bịa thêm số liệu và không tự ý kết luận xếp loại rèn luyện thay giáo viên.',
      },
    });

    res.json({ text: response.text || '' });
  } catch (error) {
    console.error('Gemini analyze error:', error);
    const message = error instanceof Error ? error.message : 'Lỗi khi gọi Gemini AI.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/gemini/subject-analyze', requireApprovedTeacher, async (req: AuthenticatedRequest, res) => {
  try {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ. Vui lòng thiết lập khóa trong Settings > Secrets.',
      });
      return;
    }

    const { prompt } = req.body as { prompt?: string };
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Thiếu dữ liệu bộ môn để phân tích.' });
      return;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'Bạn là trợ lý chuyên môn hỗ trợ giáo viên bộ môn THPT. Dựa trên bản đồ kiến thức, kết quả kiểm tra nhanh và sổ tay lỗi sai thực tế, hãy đề xuất phương án phụ đạo theo nhóm kỹ năng cụ thể, ngắn gọn, dễ áp dụng.',
      },
    });

    res.json({ text: response.text || '' });
  } catch (error) {
    console.error('Gemini subject-analyze error:', error);
    const message = error instanceof Error ? error.message : 'Lỗi khi gọi Gemini AI.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/gemini/parent-comm', requireApprovedTeacher, async (req: AuthenticatedRequest, res) => {
  try {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ. Vui lòng thiết lập khóa trong Settings > Secrets.',
      });
      return;
    }

    const { prompt } = req.body as { prompt?: string };
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Thiếu thông tin học sinh để soạn thảo.' });
      return;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'Bạn là Giáo viên Chủ nhiệm tận tâm, chuẩn mực sư phạm. Hãy viết 1 tin nhắn gửi phụ huynh và 1 nhận xét học bạ ngắn gọn bằng tiếng Việt dựa đúng trên dữ liệu được cung cấp.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: {
              type: Type.STRING,
              description: 'Tin nhắn gửi phụ huynh lịch sự, chân thành, có dữ liệu cụ thể.',
            },
            reportCardDraft: {
              type: Type.STRING,
              description: 'Nhận xét học bạ súc tích, đúng chuẩn sư phạm.',
            },
          },
          required: ['message', 'reportCardDraft'],
        },
      },
    });

    const raw = (response.text || '{}').trim();
    const parsed = JSON.parse(raw);
    res.json(parsed);
  } catch (error) {
    console.error('Gemini parent-comm error:', error);
    const message = error instanceof Error ? error.message : 'Lỗi khi gọi Gemini AI.';
    res.status(500).json({ error: message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GVCN 360 AI PRO server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
