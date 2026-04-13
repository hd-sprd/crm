-- Enable Row-Level Security on all tables.
-- Run this once in the Supabase SQL Editor (project: spreadhub-crm).
--
-- The app connects as the postgres superuser which bypasses RLS automatically.
-- This only blocks the anonymous PostgREST role — fixing both:
--   • rls_disabled_in_public
--   • sensitive_columns_exposed (hashed_password, portal_token, ms_access_token, etc.)

ALTER TABLE public.users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_views           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_stages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequences             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_steps        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_enrollments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_field_defs     ENABLE ROW LEVEL SECURITY;
