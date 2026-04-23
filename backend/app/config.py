from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Spreadshirt CRM"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://crm:crm@localhost:5432/crm"
    DATABASE_SYNC_URL: str = "postgresql://crm:crm@localhost:5432/crm"

    # Azure AD SSO – role claim values (must match Azure App Role "Value" field)
    AZURE_ROLE_ADMIN: str = "CRM.Admin"
    AZURE_ROLE_SALES_MANAGER: str = "CRM.SalesManager"
    AZURE_ROLE_ACCOUNT_MANAGER: str = "CRM.AccountManager"
    AZURE_ROLE_SALES_REP: str = "CRM.SalesRep"

    # Frontend URL (used for OAuth redirects after MS Graph callback)
    FRONTEND_URL: str = "http://localhost:5173"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Microsoft Graph / Azure AD
    AZURE_TENANT_ID: Optional[str] = None
    AZURE_CLIENT_ID: Optional[str] = None
    AZURE_CLIENT_SECRET: Optional[str] = None
    AZURE_REDIRECT_URI: str = "http://localhost:8000/api/v1/integrations/ms-graph/callback"
    AZURE_SCOPES: list[str] = [
        "https://graph.microsoft.com/Mail.ReadWrite",
        "https://graph.microsoft.com/Calendars.ReadWrite",
        "https://graph.microsoft.com/User.Read",
    ]

    # Supabase (optional – enables Supabase Storage for file uploads)
    SUPABASE_URL: Optional[str] = None
    SUPABASE_SERVICE_KEY: Optional[str] = None

    # Cron secret (protects /workflow/trigger-internal)
    CRON_SECRET: Optional[str] = None

    # PDF / Branding
    COMPANY_NAME: str = "Spreadshirt"
    COMPANY_LOGO_URL: Optional[str] = None

    # Workflow defaults (days)
    LEAD_FOLLOWUP_DAYS: int = 3
    INACTIVE_DEAL_DAYS: int = 7
    OVERDUE_TASK_ESCALATION_DAYS: int = 2

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
