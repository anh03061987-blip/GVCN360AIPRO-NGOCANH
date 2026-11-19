# Security Specification — GVCN 360 AI PRO

## 1. Data Invariants
1. Every document lives under `/users/{userId}` and MUST belong to `request.auth.uid == userId` with a verified email (`request.auth.token.email_verified == true`), or an explicitly provisioned admin.
2. No document may carry shadow/ghost fields (`keys().hasOnly(...)` enforced on create; `affectedKeys().hasOnly(...)` enforced on update).
3. All `ownerUid` and `createdAt` fields are immutable after creation; `createdAt` and `updatedAt` must strictly equal `request.time`.
4. Student PII (`parentPhone`) is isolated in `/users/{userId}/workspaces/{workspaceId}/student_pii/{studentCode}` and never exposed in general student documents.
5. Tickets (`tickets/{ticketId}`) enforce terminal state locking: once `status` transitions to `approved` or `rejected`, non-admin updates are denied.
6. Audit logs (`audit_logs`) and emulation adjustment logs (`emulation_adjustments`) are append-only and cannot be updated or deleted.
7. Every path variable (`userId`, `workspaceId`, `studentCode`, `ticketId`, etc.) is guarded by `isValidId()` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Cross-Tenant Read/Write**: Authenticated User B attempts to read or write `/users/UserA/...` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoofing**: User with matching admin email `anh03061987@gmail.com` where `email_verified: false` attempts read/write -> `PERMISSION_DENIED`.
3. **Shadow/Ghost Field Injection**: Creating a `Student` with `{ ..., isVerified: true }` -> `PERMISSION_DENIED`.
4. **OwnerUid Spoofing**: Creating a `Ticket` with `ownerUid: "other_uid"` -> `PERMISSION_DENIED`.
5. **Path Poisoning (Oversized ID)**: Writing to `/users/{uid}/workspaces/{1500_char_id}/students/HS001` -> `PERMISSION_DENIED`.
6. **Client Timestamp Forgery**: Creating a `ClassPlan` with `createdAt: Timestamp(2020-01-01)` instead of `request.time` -> `PERMISSION_DENIED`.
7. **Immutable Field Tampering**: Updating a `Student` while altering `createdAt` or `code` -> `PERMISSION_DENIED`.
8. **Terminal State Bypass**: Updating a `Ticket` whose existing `status` is `approved` back to `pending` -> `PERMISSION_DENIED`.
9. **Audit Log Deletion/Tampering**: Attempting `update` or `delete` on `audit_logs/{logId}` -> `PERMISSION_DENIED`.
10. **PII Leak Attempt**: Unauthenticated or non-owner user reading `student_pii/{studentCode}` -> `PERMISSION_DENIED`.
11. **Value Type Poisoning**: Updating `ClassConfig.fundBalance` with a string `"1000000"` instead of a number -> `PERMISSION_DENIED`.
12. **Denial-of-Wallet Oversized String**: Creating a `Ticket` with a 10,000-character `description` -> `PERMISSION_DENIED`.
