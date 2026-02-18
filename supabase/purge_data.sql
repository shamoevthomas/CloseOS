-- Purge all data from public tables
TRUNCATE TABLE 
    public.profiles, 
    public.meetings, 
    public.offers, 
    public.internal_contacts, 
    public.prospects, 
    public.calls, 
    public.call_history, 
    public.user_scripts, 
    public.invoices, 
    public.booking_settings, 
    public.issuer_profiles, 
    public.payment_methods, 
    public.booking_types, 
    public.referral_codes, 
    public.cal_credentials, 
    public.notifications, 
    public.message_threads, 
    public.kpi_config 
CASCADE;

-- Attempt to delete users from auth.users (may fail if permissions are insufficient)
DELETE FROM auth.users WHERE email <> 'shamoovthomas@gmail.com'; 
-- If you really want to delete admin too:
-- DELETE FROM auth.users;
