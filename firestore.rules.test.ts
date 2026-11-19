/**
 * Payload-First Security Test Suite for GVCN 360 AI PRO
 * Verifies the "Dirty Dozen" adversarial payloads against firestore.rules.
 */
export const DIRTY_DOZEN_CASES = [
  {
    name: '1. Cross-tenant read/write attempt',
    actor: { uid: 'user_b', email: 'b@example.com', email_verified: true },
    path: '/users/user_a/workspaces/ws_1/students/HS001',
    operation: 'get',
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '2. Unverified email admin spoofing',
    actor: { uid: 'attacker', email: 'anh03061987@gmail.com', email_verified: false },
    path: '/users/user_a/workspaces/ws_1/students/HS001',
    operation: 'get',
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '3. Shadow field injection on Student create',
    actor: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    path: '/users/user_a/workspaces/ws_1/students/HS001',
    operation: 'create',
    payload: { ownerUid: 'user_a', code: 'HS001', fullName: 'Test', gender: 'Nữ', team: 1, role: 'member', meritPoints: 100, isVerified: true },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '4. OwnerUid spoofing on Ticket create',
    actor: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    path: '/users/user_a/workspaces/ws_1/tickets/tk_1',
    operation: 'create',
    payload: { ownerUid: 'user_b', submittedByUid: 'user_a' },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '5. Path poisoning with oversized workspaceId',
    actor: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    path: `/users/user_a/workspaces/${'a'.repeat(200)}/students/HS001`,
    operation: 'create',
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '6. Client timestamp forgery on ClassPlan',
    actor: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    path: '/users/user_a/workspaces/ws_1/plans/p1',
    operation: 'create',
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '7. Immutable field tampering on Student update',
    actor: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    path: '/users/user_a/workspaces/ws_1/students/HS001',
    operation: 'update',
    payload: { code: 'HS999' },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '8. Terminal state bypass on approved Ticket',
    actor: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    path: '/users/user_a/workspaces/ws_1/tickets/tk_approved',
    operation: 'update',
    payload: { status: 'pending', version: 3 },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '9. Audit log tampering/deletion attempt',
    actor: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    path: '/users/user_a/workspaces/ws_1/audit_logs/log_1',
    operation: 'delete',
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '10. PII read attempt by non-owner',
    actor: { uid: 'user_b', email: 'b@example.com', email_verified: true },
    path: '/users/user_a/workspaces/ws_1/student_pii/HS001',
    operation: 'get',
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '11. Value type poisoning on fundBalance',
    actor: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    path: '/users/user_a/class_configs/active_workspace',
    operation: 'update',
    payload: { fundBalance: '1000000' },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '12. Denial-of-Wallet oversized string in Ticket description',
    actor: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    path: '/users/user_a/workspaces/ws_1/tickets/tk_2',
    operation: 'create',
    payload: { description: 'x'.repeat(5000) },
    expected: 'PERMISSION_DENIED'
  }
];
