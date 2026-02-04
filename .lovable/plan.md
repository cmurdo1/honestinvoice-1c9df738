

# Security Hardening & Admin Access Plan

## Overview
This plan addresses the security vulnerabilities in the admin dashboard and implements proper role-based access control using your Google account (crowmeista@gmail.com).

## What's Being Fixed

### Current Vulnerabilities
- Admin check uses client-side email comparison (easily bypassed)
- Any authenticated user can access webhook logs and job leads
- Edge function accepts any valid JWT token
- "Admin" terminology visible in URL and UI

### Solution
Implement server-side role verification using a proper user_roles table with SECURITY DEFINER functions, and rename admin-related items to hide from public users.

---

## Implementation Steps

### 1. Create User Roles System
Create database tables and functions for secure role management:

- Create `app_role` enum type ('admin', 'moderator', 'user')
- Create `user_roles` table with foreign key to auth.users
- Create `has_role()` SECURITY DEFINER function to check roles server-side
- Create `assign_admin_role()` function to grant your account admin access

### 2. Update RLS Policies
Restrict webhook_logs and job_leads to admin-only access:

- Drop existing permissive policies
- Create new policies using `has_role(auth.uid(), 'admin')` check

### 3. Rename Admin Components (Hide from Public)
Rename files and routes to remove "admin" visibility:

| Current | New |
|---------|-----|
| `/admin-webhooks` | `/ops-panel` |
| `AdminWebhooks.tsx` | `OpsPanel.tsx` |
| "Admin Dashboard" text | "Operations Panel" |

### 4. Update Frontend Access Control
Modify `OpsPanel.tsx` to verify admin role server-side:

- Create RPC function `check_admin_access()` that returns boolean
- Call this function before rendering admin content
- Remove hardcoded email checks

### 5. Secure Edge Function
Update `admin-webhook` edge function to verify admin role:

- Add role verification for JWT-authenticated requests
- Maintain webhook secret authentication for automated systems
- Rename to `ops-webhook` for consistency

### 6. Grant Your Access
Automatically assign admin role to crowmeista@gmail.com on first Google sign-in.

---

## Technical Details

### Database Migration SQL
```text
-- Create enum and roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER function (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Check admin access function for frontend
CREATE OR REPLACE FUNCTION public.check_admin_access()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Update RLS policies
DROP POLICY IF EXISTS "Authenticated users can view webhook logs" ON public.webhook_logs;
DROP POLICY IF EXISTS "Authenticated users can view job leads" ON public.job_leads;
DROP POLICY IF EXISTS "Authenticated users can update job leads" ON public.job_leads;

CREATE POLICY "Admins can view webhook logs" ON public.webhook_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view job leads" ON public.job_leads
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update job leads" ON public.job_leads
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
```

### File Changes

**New/Renamed Files:**
- `src/pages/AdminWebhooks.tsx` → `src/pages/OpsPanel.tsx`
- `supabase/functions/admin-webhook/` → `supabase/functions/ops-webhook/`

**Modified Files:**
- `src/App.tsx` - Update route from `/admin-webhooks` to `/ops-panel`
- `supabase/config.toml` - Rename function configuration

### Admin Role Assignment
After migration, manually insert your admin role:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users 
WHERE email = 'crowmeista@gmail.com'
ON CONFLICT DO NOTHING;
```

---

## Security Improvements Summary

| Before | After |
|--------|-------|
| Client-side email check | Server-side role verification |
| Any user can access admin data | Only admin role can access |
| "admin" visible in URL | Hidden as "ops-panel" |
| Hardcoded admin email | Database-driven roles |
| No audit trail | Role assignments tracked |

## Testing After Implementation

1. Sign in with Google (crowmeista@gmail.com)
2. Navigate to `/ops-panel`
3. Verify access is granted
4. Sign in with different account
5. Verify redirect to dashboard (access denied)
6. Test webhook endpoint still works with secret header

