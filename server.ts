import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '1mb' }));

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
// SERVER-SIDE GEMINI API ROUTES (GVCN 360 AI PRO)
// ============================================================================
app.post('/api/gemini/analyze', async (req, res) => {
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

app.post('/api/gemini/subject-analyze', async (req, res) => {
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

app.post('/api/gemini/parent-comm', async (req, res) => {
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
