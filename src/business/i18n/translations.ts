// ─── CloseOS Business — Translations FR / EN ─────────────────────────────────
// Structure: flat keys prefixed by section (sidebar_, settings_, dashboard_, etc.)
// This file will be populated incrementally as pages are translated.

export interface BusinessTranslations {
  // ─── Common / Shared ───
  common_save: string;
  common_cancel: string;
  common_close: string;
  common_delete: string;
  common_confirm: string;
  common_loading: string;
  common_error: string;
  common_success: string;
  common_search: string;
  common_filter: string;
  common_export: string;
  common_edit: string;
  common_add: string;
  common_back: string;
  common_next: string;
  common_previous: string;
  common_yes: string;
  common_no: string;
  common_all: string;
  common_none: string;
  common_today: string;
  common_this_week: string;
  common_this_month: string;
  common_this_year: string;
  common_since_forever: string;
  common_name: string;
  common_email: string;
  common_phone: string;
  common_role: string;
  common_status: string;
  common_date: string;
  common_actions: string;
  common_no_data: string;
  common_copy: string;
  common_copied: string;
  common_active: string;
  common_inactive: string;
  common_online: string;
  common_offline: string;
  common_reset: string;
  common_or: string;
  common_month: string;
  common_quarter: string;
  common_year: string;

  // ─── Sidebar ───
  sidebar_dashboard: string;
  sidebar_crm: string;
  sidebar_pipeline: string;
  sidebar_campaigns: string;
  sidebar_acquisition: string;
  sidebar_objectives: string;
  sidebar_formulas: string;
  sidebar_calls: string;
  sidebar_appointments: string;
  sidebar_agenda: string;
  sidebar_reminders: string;
  sidebar_invoices: string;
  sidebar_report: string;
  sidebar_setter_kpi: string;
  sidebar_closer_kpi: string;
  sidebar_team: string;
  sidebar_availability: string;
  sidebar_revenue: string;
  sidebar_organization: string;
  sidebar_settings: string;
  sidebar_logout: string;
  sidebar_sales_crm: string;
  sidebar_help: string;
  sidebar_personal: string;
  sidebar_onboarding_required: string;
  sidebar_secure_logout: string;
  sidebar_my_org: string;
  sidebar_member: string;

  // ─── Settings Modal ───
  settings_title: string;
  settings_tab_profile: string;
  settings_tab_security: string;
  settings_tab_interface: string;
  settings_tab_devices: string;
  settings_tab_organisation: string;
  settings_tab_support: string;
  settings_tab_delete: string;
  settings_profile_name: string;
  settings_profile_phone: string;
  settings_profile_role: string;
  settings_profile_avatar: string;
  settings_profile_save: string;
  settings_profile_saved: string;
  settings_security_current_pw: string;
  settings_security_new_pw: string;
  settings_security_confirm_pw: string;
  settings_security_change: string;
  settings_interface_title: string;
  settings_dark_mode: string;
  settings_dark_mode_desc: string;
  settings_language: string;
  settings_language_desc: string;
  settings_language_fr: string;
  settings_language_en: string;
  settings_dashboard_period: string;
  settings_dashboard_period_desc: string;
  settings_sidebar_order: string;
  settings_sidebar_order_desc: string;
  settings_sidebar_reset: string;
  settings_devices_title: string;
  settings_devices_current: string;
  settings_devices_revoke: string;
  settings_devices_none: string;
  settings_org_leave: string;
  settings_org_leave_desc: string;
  settings_org_leave_confirm: string;
  settings_org_reset: string;
  settings_org_reset_desc: string;
  settings_org_reset_confirm: string;
  settings_support_email: string;
  settings_support_desc: string;
  settings_delete_title: string;
  settings_delete_desc: string;
  settings_delete_confirm: string;
  settings_delete_export_first: string;
  settings_assignable_label: string;
  settings_assignable_desc: string;

  // ─── Dashboard ───
  dashboard_title: string;
  dashboard_welcome: string;
  dashboard_period_label: string;
  dashboard_total_revenue: string;
  dashboard_total_calls: string;
  dashboard_conversion_rate: string;
  dashboard_active_prospects: string;
  dashboard_new_prospects: string;
  dashboard_appointments_today: string;
  dashboard_team_online: string;
  dashboard_no_data: string;
  dashboard_recent_activity: string;
  dashboard_top_performers: string;
  dashboard_revenue_chart: string;
  dashboard_calls_chart: string;

  // ─── CRM ───
  crm_title: string;
  crm_search_placeholder: string;
  crm_add_prospect: string;
  crm_no_prospects: string;
  crm_status_new: string;
  crm_status_contacted: string;
  crm_status_qualified: string;
  crm_status_proposal: string;
  crm_status_won: string;
  crm_status_lost: string;
  crm_status_no_show: string;
  crm_filter_all: string;
  crm_filter_mine: string;
  crm_sort_recent: string;
  crm_sort_name: string;
  crm_sort_amount: string;
  crm_assigned_to: string;
  crm_unassigned: string;
  crm_last_contact: string;
  crm_created_at: string;
  crm_notes: string;
  crm_add_note: string;
  crm_amount: string;

  // ─── CRM (extended) ───
  crm_connected: string;
  crm_auto_sync_in: string;
  crm_your_pipeline: string;
  crm_integration: string;
  crm_filters: string;
  crm_reset_all: string;
  crm_period: string;
  crm_team: string;
  crm_closer_setter: string;
  crm_no_members: string;
  crm_stage: string;
  crm_offer_formula: string;
  crm_no_formulas: string;
  crm_tags: string;
  crm_no_tags: string;
  crm_no_prospect_found: string;
  crm_contact_header: string;
  crm_company_header: string;
  crm_email_header: string;
  crm_phone_header: string;
  crm_stage_header: string;
  crm_tags_header: string;
  crm_value_header: string;
  crm_date_header: string;
  crm_actions_header: string;
  crm_new_prospect: string;
  crm_contact_name: string;
  crm_email_label: string;
  crm_phone_label: string;
  crm_company_label: string;
  crm_offer_label: string;
  crm_no_offer: string;
  crm_setter_label: string;
  crm_no_setter: string;
  crm_choose_setter: string;
  crm_closer_label: string;
  crm_no_closer: string;
  crm_round_robin: string;
  crm_random: string;
  crm_you: string;
  crm_closer_auto_assigned: string;
  crm_optional: string;
  crm_manage_tags: string;
  crm_manage_tags_desc: string;
  crm_tag_name_placeholder: string;
  crm_no_tags_created: string;
  crm_system_tag: string;
  crm_tag_exists: string;
  crm_tag_created: string;
  crm_tag_deleted: string;
  crm_delete_tag_confirm: string;
  crm_prospect_no_name: string;
  crm_export: string;
  crm_7_days: string;
  crm_30_days: string;
  crm_90_days: string;
  crm_stage_prospect: string;
  crm_stage_qualified: string;
  crm_stage_unqualified: string;
  crm_stage_won: string;
  crm_stage_followup: string;
  crm_stage_noanswer: string;
  crm_stage_noshow: string;
  crm_stage_lost: string;
  crm_contact_name_placeholder: string;
  crm_prospects_plural: string;
  crm_prospect_singular: string;

  // ─── Pipeline ───
  pipeline_title: string;
  pipeline_owner_title: string;
  pipeline_filter_member: string;
  pipeline_total: string;
  pipeline_drag_hint: string;
  pipeline_search: string;
  pipeline_filters: string;
  pipeline_reset_all: string;
  pipeline_new_status: string;
  pipeline_config_title: string;
  pipeline_period: string;
  pipeline_team: string;
  pipeline_closer_setter: string;
  pipeline_no_members: string;
  pipeline_stage: string;
  pipeline_offer_formula: string;
  pipeline_no_formulas: string;
  pipeline_tags: string;
  pipeline_no_tags: string;
  pipeline_prospect_no_name: string;
  pipeline_no_prospect_found: string;
  pipeline_active_flow: string;
  pipeline_priority_ops: string;
  pipeline_inactive_flow: string;
  pipeline_archives: string;
  pipeline_custom_stages: string;
  pipeline_created_by_team: string;
  pipeline_elements: string;
  pipeline_no_prospect: string;
  pipeline_contact_header: string;
  pipeline_company_header: string;
  pipeline_stage_header: string;
  pipeline_tags_header: string;
  pipeline_assigned_header: string;
  pipeline_value_header: string;
  pipeline_date_header: string;
  pipeline_actions_header: string;
  pipeline_auto_reset: string;
  pipeline_auto_reset_desc: string;
  pipeline_enable_reset: string;
  pipeline_enable_reset_desc: string;
  pipeline_frequency: string;
  pipeline_weekly: string;
  pipeline_biweekly: string;
  pipeline_monthly: string;
  pipeline_columns_to_clear: string;
  pipeline_columns_desc: string;
  pipeline_default_label: string;
  pipeline_last_reset: string;
  pipeline_saving: string;
  pipeline_config_saved: string;
  pipeline_save_error: string;
  pipeline_new_stage_title: string;
  pipeline_crm_warning: string;
  pipeline_stage_title_label: string;
  pipeline_stage_title_placeholder: string;
  pipeline_stage_desc: string;
  pipeline_stage_desc_placeholder: string;
  pipeline_stage_color: string;
  pipeline_stage_roles: string;
  pipeline_stage_creating: string;
  pipeline_stage_create: string;
  pipeline_stage_created: string;
  pipeline_stage_create_error: string;
  pipeline_delete_stage_confirm: string;
  pipeline_at: string;
  pipeline_stage_prospect: string;
  pipeline_stage_qualified: string;
  pipeline_stage_unqualified: string;
  pipeline_stage_won: string;
  pipeline_stage_followup: string;
  pipeline_stage_noanswer: string;
  pipeline_stage_noshow: string;
  pipeline_stage_lost: string;
  pipeline_period_all: string;
  pipeline_period_7days: string;
  pipeline_period_30days: string;
  pipeline_period_90days: string;
  pipeline_config_pipeline: string;
  pipeline_crm_warning_text: string;
  pipeline_prospect_count: string;
  pipeline_prospect_count_plural: string;

  // ─── Team ───
  team_title: string;
  team_invite: string;
  team_invite_link: string;
  team_members: string;
  team_role_owner: string;
  team_role_admin: string;
  team_role_hos: string;
  team_role_closer: string;
  team_role_setter: string;
  team_role_setter_closer: string;
  team_seats_used: string;
  team_seats_available: string;
  team_buy_seats: string;
  team_remove_member: string;
  team_remove_confirm: string;
  team_last_seen: string;
  team_joined: string;
  team_pending_invites: string;
  team_member_count: string;
  team_member_count_plural: string;
  team_manage_subtitle: string;
  team_back_to_team: string;
  team_delete: string;
  team_phone_updated: string;
  team_not_provided: string;
  team_link_copied: string;
  team_booking_links: string;
  team_no_booking_links: string;
  team_copy_link: string;
  team_open: string;
  team_prospect_count: string;
  team_sale_count: string;
  team_slot_count: string;
  team_absence_count: string;
  team_status_absent: string;
  team_status_online: string;
  team_status_offline: string;
  team_no_role: string;
  team_today: string;
  team_days: string;
  team_months: string;
  team_years: string;
  team_day_mon: string;
  team_day_tue: string;
  team_day_wed: string;
  team_day_thu: string;
  team_day_fri: string;
  team_day_sat: string;
  team_day_sun: string;
  team_pipeline_stages_prospect: string;
  team_pipeline_stages_qualified: string;
  team_pipeline_stages_followup: string;
  team_pipeline_stages_won: string;
  team_pipeline_stages_noshow: string;
  team_pipeline_stages_lost: string;
  team_role_change_error: string;
  team_role_updated: string;
  team_pay_date_updated: string;
  team_role_management: string;
  team_role_assignment: string;
  team_scope_visibility: string;
  team_scope_self: string;
  team_scope_team: string;
  team_scope_self_desc: string;
  team_scope_team_desc: string;
  team_save: string;
  team_compensation: string;
  team_compensation_type: string;
  team_comp_commission: string;
  team_comp_fixed: string;
  team_comp_fixed_plus_commission: string;
  team_fixed_salary_monthly: string;
  team_fixed_salary_placeholder: string;
  team_setter_commissions: string;
  team_setter_commissions_desc: string;
  team_compensation_updated: string;
  team_pay_date: string;
  team_pay_date_desc: string;
  team_pay_date_day: string;
  team_next_payment: string;
  team_bonuses: string;
  team_bonus_add: string;
  team_bonus_label_placeholder: string;
  team_bonus_amount_placeholder: string;
  team_bonus_link_invoice: string;
  team_bonus_no_invoice: string;
  team_bonus_link_invoice_desc: string;
  team_bonus_cancel: string;
  team_bonus_none: string;
  team_bonus_added: string;
  team_bonus_deleted: string;
  team_bonus_marked_paid: string;
  team_bonus_mark_paid: string;
  team_bonus_status_paid: string;
  team_bonus_status_pending: string;
  team_bonus_total: string;
  team_connection_history: string;
  team_last_week: string;
  team_no_history: string;
  team_log_in: string;
  team_log_out: string;
  team_pipeline_distribution: string;
  team_weekly_slots: string;
  team_no_slots: string;
  team_unavailable: string;
  team_planned_absences: string;
  team_no_absences: string;
  team_absence_label: string;
  team_upcoming_appointments: string;
  team_no_upcoming_appointments: string;
  team_th_prospect: string;
  team_th_date: string;
  team_th_status: string;
  team_appt_appointment: string;
  team_appt_at_member: string;
  team_appt_confirmed: string;
  team_appt_done: string;
  team_appt_pending: string;
  team_label_email: string;
  team_label_whatsapp: string;
  team_label_birthday: string;
  team_label_arrival: string;
  team_label_prospects: string;
  team_label_sales: string;
  team_label_revenue: string;
  team_label_conversion: string;
  team_label_noshow: string;
  team_label_lost: string;
  team_years_old: string;
  team_delete_error: string;
  team_error: string;

  // ─── Campaigns ───
  campaigns_title: string;
  campaigns_subtitle: string;
  campaigns_new: string;
  campaigns_create: string;
  campaigns_create_first: string;
  campaigns_save: string;
  campaigns_creating: string;
  campaigns_name: string;
  campaigns_name_required: string;
  campaigns_status: string;
  campaigns_views: string;
  campaigns_leads: string;
  campaigns_conversion: string;
  campaigns_active: string;
  campaigns_inactive: string;
  campaigns_paused: string;
  campaigns_edit: string;
  campaigns_duplicate: string;
  campaigns_delete: string;
  campaigns_delete_confirm: string;
  campaigns_no_campaigns: string;
  campaigns_empty_desc: string;
  campaigns_created: string;
  campaigns_modified: string;
  campaigns_deleted: string;
  campaigns_activated: string;
  campaigns_deactivated: string;
  campaigns_copied: string;
  campaigns_network_error: string;
  campaigns_creation_error: string;
  campaigns_source_created: string;
  campaigns_config_title: string;
  campaigns_new_title: string;
  campaigns_tab_general: string;
  campaigns_tab_landing: string;
  campaigns_tab_fields: string;
  campaigns_tab_qualification: string;
  campaigns_tab_booking: string;
  campaigns_tab_assignation: string;
  campaigns_tab_payment: string;
  campaigns_stripe_integration: string;
  campaigns_stripe_not_connected: string;
  campaigns_stripe_connect_first: string;
  campaigns_stripe_price: string;
  campaigns_stripe_currency: string;
  campaigns_stripe_fee_notice: string;
  campaigns_payment_timing: string;
  campaigns_payment_before: string;
  campaigns_payment_after: string;
  campaigns_payment_before_desc: string;
  campaigns_payment_after_desc: string;
  campaigns_refund_enabled: string;
  campaigns_refund_tiers: string;
  campaigns_refund_days_before: string;
  campaigns_refund_percent: string;
  campaigns_refund_add_tier: string;
  campaigns_refund_remove_tier: string;
  campaigns_reschedule_enabled: string;
  campaigns_reschedule_free: string;
  campaigns_reschedule_paid: string;
  campaigns_reschedule_price: string;
  campaigns_identification: string;
  campaigns_assigned_team: string;
  campaigns_all_team: string;
  campaigns_team_hint: string;
  campaigns_capture_type: string;
  campaigns_appointment: string;
  campaigns_direct_planning: string;
  campaigns_registration: string;
  campaigns_classic_form: string;
  campaigns_rdv: string;
  campaigns_source: string;
  campaigns_new_source: string;
  campaigns_source_name: string;
  campaigns_internal_desc: string;
  campaigns_internal_note: string;
  campaigns_utm_params: string;
  campaigns_associated_formula: string;
  campaigns_no_formula: string;
  campaigns_formula_hint: string;
  campaigns_booking_with: string;
  campaigns_no_rdv: string;
  campaigns_no_rdv_desc: string;
  campaigns_assign_mode: string;
  campaigns_specific_member: string;
  campaigns_all_role: string;
  campaigns_multiple_members: string;
  campaigns_choose_member: string;
  campaigns_select_members: string;
  campaigns_distribution: string;
  campaigns_round_robin: string;
  campaigns_random: string;
  campaigns_round_robin_desc: string;
  campaigns_random_desc: string;
  campaigns_landing_desc: string;
  campaigns_main_title: string;
  campaigns_main_title_placeholder: string;
  campaigns_subtitle_label: string;
  campaigns_subtitle_placeholder: string;
  campaigns_desc_text: string;
  campaigns_desc_text_placeholder: string;
  campaigns_video_url: string;
  campaigns_video_hint: string;
  campaigns_redirect_url: string;
  campaigns_redirect_hint: string;
  campaigns_popup_config: string;
  campaigns_popup_instant: string;
  campaigns_popup_after_3s: string;
  campaigns_popup_after_5s: string;
  campaigns_popup_after_10s: string;
  campaigns_popup_after_15s: string;
  campaigns_popup_after_30s: string;
  campaigns_popup_after_1m: string;
  campaigns_popup_hint: string;
  campaigns_required_fields: string;
  campaigns_always_required: string;
  campaigns_required: string;
  campaigns_optional: string;
  campaigns_lead_email: string;
  campaigns_lead_phone: string;
  campaigns_custom_fields: string;
  campaigns_add_field: string;
  campaigns_no_custom_fields: string;
  campaigns_field_name: string;
  campaigns_type_text: string;
  campaigns_type_number: string;
  campaigns_type_select: string;
  campaigns_select_options: string;
  campaigns_add_option: string;
  campaigns_enable_questionnaire: string;
  campaigns_enable_questionnaire_desc: string;
  campaigns_questionnaire_required: string;
  campaigns_questionnaire_required_desc: string;
  campaigns_auto_qualification: string;
  campaigns_auto_qualification_desc: string;
  campaigns_max_eliminatory: string;
  campaigns_max_eliminatory_desc: string;
  campaigns_add_question: string;
  campaigns_no_questions: string;
  campaigns_your_question: string;
  campaigns_counts_in_scoring: string;
  campaigns_out_of_scoring: string;
  campaigns_free_text: string;
  campaigns_single_select: string;
  campaigns_multiple_choice: string;
  campaigns_number: string;
  campaigns_text_no_auto_eval: string;
  campaigns_answer_options: string;
  campaigns_expected_answers: string;
  campaigns_eliminatory_answers: string;
  campaigns_expected_value: string;
  campaigns_eliminatory_value: string;
  campaigns_value_or_min: string;
  campaigns_max_optional: string;
  campaigns_booking_duration: string;
  campaigns_booking_title_label: string;
  campaigns_booking_desc_label: string;
  campaigns_var_lead_name: string;
  campaigns_var_lead_email: string;
  campaigns_var_lead_phone: string;
  campaigns_var_assignee_name: string;
  campaigns_var_formula_name: string;
  campaigns_var_campaign_name: string;
  campaigns_embed_page_desc: string;
  campaigns_embed_integrate_desc: string;
  campaigns_code_tuto: string;
  campaigns_customize: string;
  campaigns_capture_page_link: string;
  campaigns_open: string;
  campaigns_link: string;
  campaigns_custom_link: string;
  campaigns_full_page_link: string;
  campaigns_font: string;
  campaigns_primary_color: string;
  campaigns_background: string;
  campaigns_text_color: string;
  campaigns_border_radius: string;
  campaigns_border_radius_corners: string;
  campaigns_square: string;
  campaigns_rounded: string;
  campaigns_layout: string;
  campaigns_vertical: string;
  campaigns_horizontal: string;
  campaigns_copy_custom_link: string;
  campaigns_live_preview: string;
  campaigns_how_it_works: string;
  campaigns_popup_step1_prefix: string;
  campaigns_popup_step1_after: string;
  campaigns_popup_step1_seconds: string;
  campaigns_popup_step1_instant: string;
  campaigns_popup_step1_suffix: string;
  campaigns_popup_step2: string;
  campaigns_popup_step3: string;
  campaigns_popup_step4: string;
  campaigns_popup_step5_prefix: string;
  campaigns_popup_step5_suffix: string;
  campaigns_iframe_step1: string;
  campaigns_iframe_step2: string;
  campaigns_iframe_step3: string;
  campaigns_iframe_step4: string;
  campaigns_code_to_embed: string;
  campaigns_copy_code: string;
  campaigns_copy_full_page_link: string;
  campaigns_style: string;

  // ─── Acquisition ───
  acquisition_title: string;
  acquisition_total_views: string;
  acquisition_total_leads: string;
  acquisition_conversion_rate: string;
  acquisition_by_campaign: string;
  acquisition_by_source: string;
  acquisition_chart_views: string;
  acquisition_chart_leads: string;
  acquisition_subtitle: string;
  acquisition_active_campaigns: string;
  acquisition_total_views_label: string;
  acquisition_registration_rate: string;
  acquisition_leads_views: string;
  acquisition_ca_generated: string;
  acquisition_clients_won: string;
  acquisition_clients_won_plural: string;
  acquisition_performance_by_campaign: string;
  acquisition_granular_details: string;
  acquisition_active: string;
  acquisition_inactive: string;
  acquisition_views_label: string;
  acquisition_leads_label: string;
  acquisition_conversion_rate_label: string;
  acquisition_distribution_by_campaign: string;
  acquisition_most_viewed: string;
  acquisition_most_converted: string;
  acquisition_no_data: string;
  acquisition_views_tooltip: string;
  acquisition_client_conversion: string;
  acquisition_ca_by_campaign: string;
  acquisition_projection_vs_actual: string;
  acquisition_actual: string;
  acquisition_implication_rate: string;
  acquisition_implication_desc: string;
  acquisition_education_rate: string;
  acquisition_education_desc: string;
  acquisition_include_noanswer_noshow: string;
  acquisition_empty_title: string;
  acquisition_empty_desc: string;

  // ─── Objectives ───
  objectives_title: string;
  objectives_add: string;
  objectives_target: string;
  objectives_current: string;
  objectives_progress: string;
  objectives_assign_to: string;
  objectives_type_calls: string;
  objectives_type_revenue: string;
  objectives_type_conversion: string;
  objectives_type_prospects: string;
  objectives_no_objectives: string;
  objectives_personal: string;
  objectives_team: string;
  objectives_cycle: string;
  objectives_daily: string;
  objectives_weekly: string;
  objectives_monthly: string;
  objectives_my_title: string;
  objectives_subtitle: string;
  objectives_new_objective: string;
  objectives_tab_assigned: string;
  objectives_tab_org: string;
  objectives_tab_personal: string;
  objectives_no_org: string;
  objectives_no_org_desc: string;
  objectives_no_assigned: string;
  objectives_no_assigned_desc: string;
  objectives_no_personal: string;
  objectives_no_personal_desc: string;
  objectives_create_first: string;
  objectives_percent_reached: string;
  objectives_overdue: string;
  objectives_deadline: string;
  objectives_visible_to_manager: string;
  objectives_private: string;
  objectives_edit_title: string;
  objectives_new_personal: string;
  objectives_label_required: string;
  objectives_label_name: string;
  objectives_label_name_placeholder: string;
  objectives_label_metric: string;
  objectives_label_description: string;
  objectives_label_description_placeholder: string;
  objectives_label_target: string;
  objectives_label_target_placeholder: string;
  objectives_label_period: string;
  objectives_label_deadline: string;
  objectives_visibility_visible: string;
  objectives_visibility_visible_desc: string;
  objectives_visibility_private: string;
  objectives_visibility_private_desc: string;
  objectives_modified: string;
  objectives_created: string;
  objectives_deleted: string;
  objectives_delete_confirm: string;
  objectives_network_error: string;
  objectives_metric_revenue: string;
  objectives_metric_sales_count: string;
  objectives_metric_conversion_rate: string;
  objectives_metric_leads: string;
  objectives_metric_appointments: string;
  objectives_metric_noshow_rate: string;
  objectives_metric_custom: string;
  objectives_period_weekly: string;
  objectives_period_monthly: string;
  objectives_period_quarterly: string;
  objectives_period_yearly: string;
  objectives_period_short_weekly: string;
  objectives_period_short_monthly: string;
  objectives_period_short_quarterly: string;
  objectives_period_short_yearly: string;

  // ─── Formulas ───
  formulas_title: string;
  formulas_add: string;
  formulas_name: string;
  formulas_price: string;
  formulas_description: string;
  formulas_commission: string;
  formulas_no_formulas: string;
  formulas_edit: string;
  formulas_delete: string;

  // ─── Appointments ───
  appointments_title: string;
  appointments_upcoming: string;
  appointments_past: string;
  appointments_no_appointments: string;
  appointments_with: string;
  appointments_at: string;
  appointments_status_confirmed: string;
  appointments_status_pending: string;
  appointments_status_cancelled: string;
  appointments_status_done: string;
  appointments_status_no_show: string;
  appointments_add: string;
  appointments_reschedule: string;
  appointments_cancel: string;

  // ─── Agenda ───
  agenda_title: string;
  agenda_today: string;
  agenda_week: string;
  agenda_no_events: string;

  // ─── Reminders ───
  reminders_title: string;
  reminders_add: string;
  reminders_no_reminders: string;
  reminders_due: string;
  reminders_overdue: string;
  reminders_completed: string;
  reminders_tomorrow: string;
  reminders_yesterday: string;
  reminders_status_upcoming: string;
  reminders_status_overdue: string;
  reminders_status_done: string;
  reminders_created_toast: string;
  reminders_create_error: string;
  reminders_page_title: string;
  reminders_total_count: string;
  reminders_late_count: string;
  reminders_overdue_alert: string;
  reminders_view_urgent: string;
  reminders_team_all: string;
  reminders_reset_filters: string;
  reminders_new_reminder: string;
  reminders_all_up_to_date: string;
  reminders_no_reminders_desc: string;
  reminders_add_reminder: string;
  reminders_header_title: string;
  reminders_header_description: string;
  reminders_header_datetime: string;
  reminders_header_assigned: string;
  reminders_header_linked: string;
  reminders_header_status: string;
  reminders_header_actions: string;
  reminders_me: string;
  reminders_myself: string;
  reminders_detail_title: string;
  reminders_label_title: string;
  reminders_label_description: string;
  reminders_label_datetime: string;
  reminders_at_time: string;
  reminders_label_assigned_to: string;
  reminders_member: string;
  reminders_label_linked_prospect: string;
  reminders_view_card: string;
  reminders_label_created_at: string;
  reminders_mark_done: string;
  reminders_delete: string;
  reminders_modal_title: string;
  reminders_modal_subtitle: string;
  reminders_form_title: string;
  reminders_form_title_placeholder: string;
  reminders_form_description: string;
  reminders_form_description_placeholder: string;
  reminders_form_date: string;
  reminders_form_time: string;
  reminders_form_assign_to: string;
  reminders_form_myself_option: string;
  reminders_form_link_to: string;
  reminders_form_link_none: string;
  reminders_form_link_prospect: string;
  reminders_form_search_prospect: string;
  reminders_form_no_prospect_found: string;
  reminders_form_linked_to: string;
  reminders_form_submit: string;

  // ─── Invoices / Factures ───
  invoices_title: string;
  invoices_create: string;
  invoices_no_invoices: string;
  invoices_amount: string;
  invoices_date: string;
  invoices_status_paid: string;
  invoices_status_pending: string;
  invoices_status_overdue: string;
  invoices_client: string;
  invoices_download: string;
  invoices_org_title: string;

  // ─── Report ───
  report_title: string;
  report_export_pdf: string;
  report_period: string;
  report_summary: string;
  report_by_member: string;
  report_by_offer: string;
  report_total_revenue: string;
  report_total_calls: string;
  report_conversion_rate: string;
  report_mmr_title: string;
  report_7_days: string;
  report_14_days: string;
  report_30_days: string;
  report_90_days: string;
  report_6_months: string;
  report_1_year: string;
  report_all_time: string;
  report_subtitle: string;
  report_export_pdf_btn: string;
  report_ca_generated: string;
  report_sales: string;
  report_avg_short: string;
  report_closing_rate: string;
  report_closing_rate_high: string;
  report_closing_rate_normal: string;
  report_closing_rate_low: string;
  report_estimated_commission: string;
  report_total_leads: string;
  report_show_up: string;
  report_no_show: string;
  report_loss_rate: string;
  report_you: string;
  report_member: string;
  report_added_prospect: string;
  report_closed_sale: string;
  report_lost_deal: string;
  report_marked_noshow: string;
  report_modified_pipeline: string;
  report_scheduled_appointment: string;
  report_scheduled_reminder: string;
  report_activity_feed_today: string;
  report_all_members: string;
  report_me_owner: string;
  report_no_activity_today: string;
  report_leads_by_stage: string;
  report_no_data: string;
  report_ca_by_campaign: string;
  report_loss_reasons: string;
  report_autre_detail_title: string;
  report_result: string;
  report_results: string;
  report_all_campaigns: string;
  report_all_closers: string;
  report_all_teams: string;
  report_no_autre_found: string;
  report_try_modify_filters: string;
  report_reason: string;
  report_prospect: string;
  report_closer: string;
  report_campaign_performance: string;
  report_no_campaign: string;
  report_campaign: string;
  report_status: string;
  report_date: string;
  report_views: string;
  report_conv: string;
  report_ca: string;
  report_commission: string;
  report_active: string;
  report_paused: string;
  report_total: string;
  report_team_performance: string;
  report_no_team_member: string;
  report_wins: string;
  report_financial_summary: string;
  report_avg_deal: string;
  report_show_up_rate: string;
  report_appointments: string;
  report_total_short: string;
  report_done: string;
  report_done_plural: string;
  report_total_rdv: string;
  report_completed: string;
  report_pending: string;
  report_confirmed: string;
  report_cancelled: string;
  report_show_up_rate_label: string;
  report_detailed_pipeline: string;
  report_total_value: string;
  report_prospects: string;
  report_won: string;
  report_stage_new_lead: string;
  report_stage_qualified: string;
  report_stage_unqualified: string;
  report_stage_followup: string;
  report_stage_won: string;
  report_stage_lost: string;
  report_stage_no_answer: string;
  report_stage_no_show: string;
  report_pdf_title: string;
  report_pdf_period: string;
  report_pdf_generated_on: string;
  report_pdf_closing: string;
  report_pdf_pipeline_distribution: string;
  report_pdf_campaign_performance: string;
  report_pdf_registered: string;
  report_pdf_inactive: string;
  report_pdf_team: string;
  report_pdf_members: string;
  report_pdf_member_col: string;
  report_pdf_role: string;
  report_pdf_email: string;
  report_pdf_since: string;
  report_pdf_appointments: string;
  report_pdf_total: string;
  report_pdf_done: string;
  report_pdf_cancelled: string;
  report_pdf_show_up: string;
  report_pdf_footer: string;
  report_not_specified: string;
  report_not_assigned: string;

  // ─── KPI ───
  kpi_title: string;
  kpi_setter_title: string;
  kpi_closer_title: string;
  kpi_calls_made: string;
  kpi_calls_answered: string;
  kpi_conversion: string;
  kpi_revenue: string;
  kpi_avg_call_duration: string;
  kpi_appointments_set: string;
  kpi_no_show_rate: string;
  kpi_by_offer: string;
  kpi_evolution: string;
  kpi_period: string;
  kpi_ca_generated: string;
  kpi_total_sales: string;
  kpi_conversion_rate: string;
  kpi_active_prospects: string;
  kpi_noshow_rate: string;
  kpi_deals_lost: string;
  kpi_followup_rate: string;
  kpi_r2_closing_rate: string;
  kpi_total_leads: string;
  kpi_deals_in_progress: string;
  kpi_avg_value: string;
  kpi_closing_rate_history: string;
  kpi_ca_history: string;
  kpi_loss_reasons: string;
  kpi_closing_rate_tooltip: string;
  kpi_ca_tooltip: string;
  kpi_tab_global: string;
  kpi_tab_period: string;
  kpi_tab_member: string;
  kpi_tab_team: string;
  kpi_all_members: string;
  kpi_performance_by_member: string;
  kpi_click_member_detail: string;
  kpi_header_name: string;
  kpi_header_role: string;
  kpi_header_prospects: string;
  kpi_header_sales: string;
  kpi_header_ca: string;
  kpi_header_conv_rate: string;
  kpi_you_owner: string;
  kpi_no_team_members: string;
  kpi_back_to_list: string;
  kpi_commission_10: string;
  kpi_commission_history: string;
  kpi_no_data_yet: string;
  kpi_avg_commission: string;
  kpi_stage_distribution: string;
  kpi_loss_reasons_period: string;
  kpi_stage_followup: string;
  kpi_stage_noshow: string;
  kpi_stage_unqualified: string;
  kpi_stage_noanswer: string;
  kpi_team_members_count: string;
  kpi_no_members_in_team: string;
  kpi_performance_setter: string;
  kpi_performance_closer: string;
  kpi_team_overview: string;
  kpi_your_performance: string;
  kpi_configure: string;
  kpi_export_pdf: string;
  kpi_period_label: string;
  kpi_reset: string;
  kpi_all_periods: string;
  kpi_tab_org: string;
  kpi_tab_by_formula: string;
  kpi_tab_by_campaign: string;
  kpi_tab_by_source: string;
  kpi_tab_personal: string;
  kpi_no_formula: string;
  kpi_no_campaign: string;
  kpi_no_source: string;
  kpi_response_rate: string;
  kpi_booking_rate: string;
  kpi_responses_contacted: string;
  kpi_booked_contacted: string;
  kpi_closing_rate: string;
  kpi_won_qualified: string;
  kpi_noshow_qualified: string;
  kpi_my_commissions: string;
  kpi_commissions: string;
  kpi_closing_rate_chart: string;
  kpi_commission_chart: string;
  kpi_pipeline_summary: string;
  kpi_avg_comm: string;
  kpi_config_title: string;
  kpi_revenue_target: string;
  kpi_planned_calls: string;
  kpi_commission_rate: string;
  kpi_save_error: string;
  kpi_config_saved: string;
  kpi_pdf_exported: string;
  kpi_pdf_export_error: string;
  kpi_exported_on: string;
  kpi_org_kpis: string;
  kpi_autre_details_title: string;
  kpi_autre_results: string;
  kpi_all_closers: string;
  kpi_all_teams: string;
  kpi_autre_header_motif: string;
  kpi_autre_header_prospect: string;
  kpi_autre_header_closer: string;
  kpi_autre_header_date: string;
  kpi_no_autre_found: string;
  kpi_try_change_filters: string;
  kpi_not_specified: string;
  kpi_not_assigned: string;
  kpi_by_formula_label: string;
  kpi_by_campaign_label: string;
  kpi_by_source_label: string;
  kpi_month_jan: string;
  kpi_month_feb: string;
  kpi_month_mar: string;
  kpi_month_apr: string;
  kpi_month_may: string;
  kpi_month_jun: string;
  kpi_month_jul: string;
  kpi_month_aug: string;
  kpi_month_sep: string;
  kpi_month_oct: string;
  kpi_month_nov: string;
  kpi_month_dec: string;
  kpi_tab_by_team: string;
  kpi_stage_distribution_period: string;
  kpi_bar_prospects: string;

  // ─── Revenue ───
  revenue_title: string;
  revenue_total: string;
  revenue_monthly: string;
  revenue_by_member: string;
  revenue_by_offer: string;
  revenue_chart: string;
  revenue_stripe_connect: string;
  revenue_payments: string;
  revenue_period_this_month: string;
  revenue_period_3m: string;
  revenue_period_6m: string;
  revenue_period_this_year: string;
  revenue_period_all: string;
  revenue_tab_revenue: string;
  revenue_tab_charges: string;
  revenue_tab_margin: string;
  revenue_connect_stripe_title: string;
  revenue_connect_stripe_desc: string;
  revenue_connect_btn: string;
  revenue_stripe_syncing: string;
  revenue_resync_stripe: string;
  revenue_disconnect_stripe: string;
  revenue_disconnect_confirm: string;
  revenue_stripe_disconnected: string;
  revenue_stripe_disconnect_error: string;
  revenue_stripe_connected_success: string;
  revenue_load_error: string;
  revenue_charge_added: string;
  revenue_ca_label: string;
  revenue_net_margin: string;
  revenue_new_clients: string;
  revenue_cancellations: string;
  revenue_churn: string;
  revenue_active_subscriptions: string;
  revenue_no_active_sub: string;
  revenue_connect_stripe_to_see: string;
  revenue_sub_active: string;
  revenue_sub_trial: string;
  revenue_per_month: string;
  revenue_per_year: string;
  revenue_team_commissions: string;
  revenue_no_commission: string;
  revenue_fixed_salary: string;
  revenue_commission_label: string;
  revenue_fixed_charges: string;
  revenue_variable_charges: string;
  revenue_no_fixed_charge: string;
  revenue_no_variable_charge: string;
  revenue_label_placeholder: string;
  revenue_amount_placeholder: string;
  revenue_monthly_evolution: string;
  revenue_commissions_breakdown: string;
  revenue_stripe_benefit_1: string;
  revenue_stripe_benefit_2: string;
  revenue_stripe_benefit_3: string;
  revenue_stripe_connected_desc: string;
  revenue_sync_created: string;
  revenue_error: string;
  revenue_month_jan: string;
  revenue_month_feb: string;
  revenue_month_mar: string;
  revenue_month_apr: string;
  revenue_month_may: string;
  revenue_month_jun: string;
  revenue_month_jul: string;
  revenue_month_aug: string;
  revenue_month_sep: string;
  revenue_month_oct: string;
  revenue_month_nov: string;
  revenue_month_dec: string;

  // ─── Call Room ───
  callroom_title: string;
  callroom_script: string;
  callroom_notes: string;
  callroom_offer: string;
  callroom_resources: string;
  callroom_start_call: string;
  callroom_end_call: string;
  callroom_recording: string;
  callroom_prospect_info: string;
  callroom_save_notes: string;
  callroom_result: string;
  callroom_result_sold: string;
  callroom_result_not_sold: string;
  callroom_result_callback: string;
  callroom_result_no_show: string;
  callroom_result_cancelled: string;

  // ─── Call Details ───
  calldetails_title: string;
  calldetails_duration: string;
  calldetails_recording: string;
  calldetails_notes: string;
  calldetails_result: string;
  calldetails_prospect: string;
  calldetails_date: string;
  calldetails_offer: string;

  // ─── Availability ───
  availability_title: string;
  availability_add_slot: string;
  availability_no_slots: string;
  availability_absences: string;
  availability_add_absence: string;
  availability_from: string;
  availability_to: string;
  availability_reason: string;

  // ─── Organization ───
  org_title: string;
  org_company_name: string;
  org_logo: string;
  org_description: string;
  org_website: string;
  org_address: string;
  org_phone: string;
  org_email: string;
  org_billing_info: string;
  org_raison_sociale: string;
  org_subscription: string;
  org_plan: string;
  org_manage_subscription: string;

  // ─── Onboarding ───
  onboarding_welcome: string;
  onboarding_step: string;
  onboarding_company_name: string;
  onboarding_team_size: string;
  onboarding_niche: string;
  onboarding_finish: string;
  onboarding_skip: string;
  onboarding_tm_welcome: string;
  onboarding_tm_welcome_fallback: string;
  onboarding_tm_subtitle: string;
  onboarding_tm_first_name: string;
  onboarding_tm_last_name: string;
  onboarding_tm_dob: string;
  onboarding_tm_phone: string;
  onboarding_tm_years_old: string;
  onboarding_tm_finish: string;
  onboarding_tm_cancel_crop: string;
  onboarding_tm_validate_photo: string;
  onboarding_owner_profile_title: string;
  onboarding_owner_profile_subtitle: string;
  onboarding_owner_full_name: string;
  onboarding_owner_phone: string;
  onboarding_owner_role: string;
  onboarding_owner_continue: string;
  onboarding_owner_company_title: string;
  onboarding_owner_company_subtitle: string;
  onboarding_owner_company_name: string;
  onboarding_owner_company_placeholder: string;
  onboarding_owner_team_size: string;
  onboarding_owner_niche_sector: string;
  onboarding_owner_niche_custom_placeholder: string;
  onboarding_owner_back: string;
  onboarding_owner_cancel_crop: string;
  onboarding_owner_validate_photo: string;

  // ─── Login ───
  login_title: string;
  login_email: string;
  login_password: string;
  login_submit: string;
  login_google: string;
  login_no_account: string;
  login_register: string;
  login_forgot: string;
  login_subtitle: string;
  login_email_placeholder: string;
  login_or_continue: string;
  login_create_account: string;
  login_help: string;
  login_privacy: string;
  login_terms: string;
  login_all_rights: string;
  login_code_title: string;
  login_code_subtitle: string;
  login_code_send: string;
  login_code_back: string;
  login_code_enter_title: string;
  login_code_enter_subtitle: string;
  login_code_resend: string;
  login_code_resend_countdown: string;
  login_code_change_email: string;
  login_code_sent: string;
  login_code_new_sent: string;
  login_code_resend_error: string;
  login_code_invalid: string;
  login_code_send_error: string;
  login_code_connection_error: string;
  login_error_generic: string;
  login_error_google: string;
  login_error_credentials: string;
  login_email_label: string;
  login_your_email: string;
  register_title: string;
  register_subtitle: string;
  register_google: string;
  register_or_continue: string;
  register_name: string;
  register_submit: string;
  register_has_account: string;
  register_login: string;
  register_terms_text: string;
  register_cgu: string;
  register_and: string;
  register_privacy_policy: string;
  register_all_rights: string;
  register_error_sales_email: string;
  register_error_generic: string;
  register_error_google: string;
  verification_title: string;
  verification_subtitle: string;
  verification_verify: string;
  verification_verifying: string;
  verification_resend: string;
  verification_resend_countdown: string;
  verification_code_sent: string;
  verification_cancel: string;
  invitation_invalid_link: string;
  invitation_expired: string;
  invitation_validate_error: string;
  invitation_join_team: string;
  invitation_as_role: string;
  invitation_first_name: string;
  invitation_last_name: string;
  invitation_submit: string;
  invitation_google: string;
  invitation_or_continue: string;
  invitation_success_title: string;
  invitation_success_subtitle: string;
  invitation_go_dashboard: string;
  invitation_accept_error: string;
  invitation_email_sales_conflict: string;
  invitation_account_sales_conflict: string;
  invitation_account_creation_error: string;
  invitation_generic_error: string;
  invitation_google_error: string;
  invitation_google_sales_conflict: string;
  invitation_accept_error_short: string;
  invitation_invalid_title: string;
  invitation_create_business: string;
  invitation_welcome_title: string;
  invitation_welcome_joined: string;
  invitation_welcome_as: string;
  invitation_redirecting: string;
  invitation_join_company: string;
  invitation_leader: string;
  invitation_website: string;
  invitation_address: string;
  invitation_secure_access: string;
  invitation_invited_by: string;
  invitation_or_email: string;
  invitation_email_label: string;
  invitation_password_label: string;
  invitation_accept_btn: string;
  invitation_terms_prefix: string;
  invitation_terms_link: string;
  invitation_terms_and: string;
  invitation_privacy_link: string;
  invitation_already_account: string;
  invitation_login: string;
  invitation_default_manager: string;
  invitation_default_company: string;
  invitation_default_role: string;
  // ─── Closer Dashboard ───
  closer_dashboard_activity_status: string;
  closer_dashboard_view_kpis: string;
  closer_dashboard_tooltip_commission: string;
  closer_dashboard_tooltip_ca: string;
  closer_dashboard_commission: string;
  closer_dashboard_ca_generated: string;
  closer_dashboard_tooltip_closing: string;
  closer_dashboard_closing: string;
  closer_dashboard_signed_decided: string;
  closer_dashboard_tooltip_booking: string;
  closer_dashboard_booking: string;
  closer_dashboard_booked_prospects: string;
  closer_dashboard_tooltip_appointments: string;
  closer_dashboard_appointments_label: string;
  closer_dashboard_upcoming: string;
  closer_dashboard_tooltip_noshow: string;
  closer_dashboard_noshow: string;
  closer_dashboard_upcoming_appointments: string;
  closer_dashboard_upcoming_desc: string;
  closer_dashboard_view_all: string;
  closer_dashboard_no_appointments: string;
  closer_dashboard_appointment_fallback: string;
  closer_dashboard_reminders: string;
  closer_dashboard_no_reminders: string;
  closer_dashboard_overdue: string;
  closer_dashboard_upcoming_tag: string;
  closer_dashboard_overdue_prefix: string;
  closer_dashboard_mark_done_title: string;
  closer_dashboard_create_reminder: string;
  closer_dashboard_member_fallback: string;
  dashboard_appt_today: string;
  dashboard_appt_tomorrow: string;
  dashboard_reminder_done: string;
  return_payment_success: string;
  return_create_account: string;
  return_name: string;
  return_submit: string;
  return_creating: string;
  return_processing: string;

  // ─── Prospect View ───
  prospect_info: string;
  prospect_history: string;
  prospect_calls: string;
  prospect_appointments: string;
  prospect_notes: string;
  prospect_add_note: string;
  prospect_edit: string;
  prospect_delete: string;
  prospect_source: string;
  prospect_formula: string;
  prospect_assigned: string;
  prospect_created: string;
  prospect_amount: string;
  prospect_contact: string;
  prospect_no_name: string;
  prospect_open_callroom: string;
  prospect_create_reminder: string;
  prospect_tab_info: string;
  prospect_tab_call_notes: string;
  prospect_tab_reminders: string;
  prospect_tab_history: string;
  prospect_current_stage: string;
  prospect_loss_reason_title: string;
  prospect_loss_reason_label: string;
  prospect_loss_reason_select: string;
  prospect_loss_details: string;
  prospect_loss_details_placeholder: string;
  prospect_payment_title: string;
  prospect_payment_final_amount: string;
  prospect_payment_sale_amount: string;
  prospect_payment_cash: string;
  prospect_payment_installments: string;
  prospect_payment_nb_installments: string;
  prospect_payment_commission: string;
  prospect_payment_you_receive: string;
  prospect_payment_validate: string;
  prospect_payment_total_commission: string;
  prospect_payment_client_pays: string;
  prospect_payment_you_get: string;
  prospect_payment_times_per_month: string;
  prospect_payment_monthly: string;
  prospect_payment_label_cash: string;
  prospect_payment_label_installments: string;
  prospect_stripe_subscription: string;
  prospect_stripe_status: string;
  prospect_stripe_active: string;
  prospect_stripe_past_due: string;
  prospect_stripe_canceled: string;
  prospect_stripe_trialing: string;
  prospect_stripe_amount_label: string;
  prospect_stripe_month: string;
  prospect_stripe_year: string;
  prospect_stripe_last_payment: string;
  prospect_stripe_next_payment: string;
  prospect_stripe_linked_webhook: string;
  prospect_stripe_linked_auto: string;
  prospect_stripe_linked_manual: string;
  prospect_stripe_link_btn: string;
  prospect_stripe_link_title: string;
  prospect_stripe_auto_search: string;
  prospect_stripe_not_found: string;
  prospect_stripe_search_btn: string;
  prospect_stripe_search_placeholder: string;
  prospect_stripe_no_customer: string;
  prospect_stripe_no_sub: string;
  prospect_stripe_link_manual_btn: string;
  prospect_stripe_linked_success: string;
  prospect_assign_closer: string;
  prospect_assign_setter: string;
  prospect_assign_none: string;
  prospect_campaign_origin: string;
  prospect_offer_formula: string;
  prospect_no_offer: string;
  prospect_capture_responses: string;
  prospect_qualification: string;
  prospect_answers: string;
  prospect_global_score: string;
  prospect_eliminatory: string;
  prospect_disqualified: string;
  prospect_client_card: string;
  prospect_phone: string;
  prospect_creation_date: string;
  prospect_next_appointment: string;
  prospect_internal_notes: string;
  prospect_notes_placeholder: string;
  prospect_save_btn: string;
  prospect_cancel_btn: string;
  prospect_no_notes: string;
  prospect_capture_data_ref: string;
  prospect_add_manual_note: string;
  prospect_new_note: string;
  prospect_note_placeholder: string;
  prospect_no_call_notes: string;
  prospect_manual_notes_hint: string;
  prospect_add_reminder: string;
  prospect_no_reminders: string;
  prospect_create_reminder_hint: string;
  prospect_reminder_done: string;
  prospect_reminder_overdue: string;
  prospect_new_reminder: string;
  prospect_reminder_title: string;
  prospect_reminder_title_placeholder: string;
  prospect_reminder_description: string;
  prospect_reminder_desc_placeholder: string;
  prospect_reminder_date: string;
  prospect_reminder_time: string;
  prospect_reminder_linked: string;
  prospect_reminder_this_prospect: string;
  prospect_reminder_create_btn: string;
  prospect_no_history: string;
  prospect_history_changes_hint: string;
  prospect_history_by: string;
  prospect_history_created: string;
  prospect_history_stage_arrow: string;
  prospect_history_step_change: string;
  prospect_history_stripe_renewal: string;
  prospect_history_stripe_linked: string;
  prospect_history_field_modified: string;
  prospect_history_fields_modified: string;
  prospect_footer_delete: string;
  prospect_footer_add_pipeline: string;
  prospect_footer_remove_pipeline: string;
  prospect_footer_save: string;
  prospect_toast_photo_updated: string;
  prospect_toast_upload_error: string;
  prospect_toast_file_required: string;
  prospect_toast_file_too_large: string;
  prospect_toast_stripe_auto: string;
  prospect_toast_stripe_linked: string;
  prospect_toast_stripe_manual: string;
  prospect_toast_stripe_error: string;
  prospect_toast_stripe_link_error: string;
  prospect_toast_stripe_success: string;
  prospect_toast_reminder_created: string;
  prospect_toast_reminder_error: string;
  prospect_toast_email_missing: string;
  prospect_toast_phone_missing: string;
  prospect_toast_added_pipeline: string;
  prospect_toast_removed_pipeline: string;
  prospect_toast_error: string;
  prospect_confirm_delete_note: string;
  prospect_confirm_delete: string;
  prospect_no_tags: string;
  prospect_change_photo: string;
  prospect_history_empty: string;
  prospect_history_yes: string;
  prospect_history_no: string;
  prospect_history_cash: string;
  prospect_history_installments_label: string;
  prospect_history_photo_updated: string;
  prospect_history_none_formula: string;
  prospect_field_firstname: string;
  prospect_field_lastname: string;
  prospect_field_contact: string;
  prospect_field_email: string;
  prospect_field_phone_label: string;
  prospect_field_company: string;
  prospect_field_title: string;
  prospect_field_stage: string;
  prospect_field_value: string;
  prospect_field_offer: string;
  prospect_field_offer_id: string;
  prospect_field_formula_id: string;
  prospect_field_assigned_closer: string;
  prospect_field_assigned_setter: string;
  prospect_field_payment_type: string;
  prospect_field_installments: string;
  prospect_field_probability: string;
  prospect_field_notes_label: string;
  prospect_field_avatar: string;
  prospect_field_pipeline_visible: string;
  prospect_field_loss_reason: string;
  prospect_field_loss_details: string;
  prospect_field_stripe_sub: string;
  prospect_field_sub_status: string;
  prospect_system_author: string;
  prospect_manual_author: string;
  prospect_search_label: string;
  prospect_manual_label: string;

  // ─── Invite Modal ───
  invite_title: string;
  invite_desc: string;
  invite_role_label: string;
  invite_generate: string;
  invite_link_ready: string;
  invite_copy: string;
  invite_expires: string;
  invite_admin_full_access: string;
  invite_admin_same_rights: string;
  invite_hos_campaign_mgmt: string;
  invite_hos_campaign_desc: string;
  invite_setter_mode: string;
  invite_setter_self: string;
  invite_setter_all: string;
  invite_setter_self_desc: string;
  invite_setter_all_desc: string;
  invite_link_generated: string;
  invite_send_by_email: string;
  invite_email_sent: string;
  invite_email_placeholder: string;
  invite_email_error: string;
  invite_close: string;
  invite_fallback_name: string;

  // ─── Paywall ───
  paywall_title: string;
  paywall_desc: string;
  paywall_upgrade: string;
  paywall_feature_locked: string;
  paywall_trial_ended: string;
  paywall_trial_ended_desc: string;
  paywall_choose_plan: string;
  paywall_contact_question: string;
  block_access_blocked: string;
  block_renewal_failed: string;
  block_days_left_prefix: string;
  block_days_left_day: string;
  block_days_left_suffix: string;
  block_deletion_in_progress: string;
  block_update_payment: string;
  block_need_help: string;

  // ─── Checkout ───
  checkout_title: string;
  checkout_plan: string;
  checkout_billing: string;
  checkout_monthly: string;
  checkout_quarterly: string;
  checkout_annual: string;
  checkout_promo: string;
  checkout_apply: string;
  checkout_total: string;
  checkout_submit: string;
  checkout_creating_sub: string;
  checkout_creating_account: string;
  checkout_name: string;
  checkout_email: string;
  checkout_phone: string;
  checkout_password: string;
  checkout_confirm_password: string;
  checkout_passwords_mismatch: string;
  checkout_password_strength: string;
  checkout_password_weak: string;
  checkout_password_medium: string;
  checkout_password_strong: string;
  checkout_password_very_strong: string;
  checkout_trial_info: string;
  checkout_back: string;
  checkout_your_plan: string;
  checkout_billing_annual_desc: string;
  checkout_billing_quarterly_desc: string;
  checkout_billing_monthly_desc: string;
  checkout_price_total_prefix: string;
  checkout_trial_days_free: string;
  checkout_hide_features: string;
  checkout_show_features: string;
  checkout_promo_placeholder: string;
  checkout_promo_free_trial: string;
  checkout_promo_lifetime: string;
  checkout_promo_extended: string;
  checkout_promo_discount: string;
  checkout_promo_applied: string;
  checkout_promo_invalid: string;
  checkout_extras_label: string;
  checkout_extras_total: string;
  checkout_payment_section: string;
  checkout_card_saved: string;
  checkout_create_account_section: string;
  checkout_error_sales_email: string;
  checkout_error_server: string;
  checkout_error_payment_failed: string;
  checkout_error_generic: string;
  checkout_validation_fields: string;
  checkout_validation_payment: string;
  checkout_step_verification: string;
  checkout_step_payment: string;
  checkout_loading: string;
  checkout_launch: string;
  checkout_terms_text: string;
  checkout_terms_cgu: string;
  checkout_terms_and: string;
  checkout_terms_privacy: string;
  checkout_lifetime_free_title: string;
  checkout_days_offered: string;
  checkout_create_start: string;
  checkout_preparing_payment: string;
  checkout_already_account: string;
  checkout_login: string;
  checkout_extra_setup_name: string;
  checkout_extra_setup_desc: string;
  checkout_extra_integration_name: string;
  checkout_extra_integration_desc: string;
  checkout_extra_combo_name: string;
  checkout_extra_combo_desc: string;

  // ─── Return (additional) ───
  return_payment_checking: string;
  return_payment_confirmed: string;
  return_finalize_account: string;
  return_email_label: string;
  return_password_label: string;
  return_password_placeholder: string;
  return_activate: string;
  return_error_sales_email: string;
  return_error_generic: string;
  return_terms_text: string;
  return_terms_cgu: string;
  return_terms_and: string;
  return_terms_privacy: string;
  return_copyright: string;

  // ─── Verification (additional) ───
  verification_required: string;
  verification_code_sent_to: string;
  verification_sending: string;
  verification_error_send: string;
  verification_error_invalid: string;
  verification_resend_in: string;
  verification_back_login: string;

  // ─── Days of week ───
  day_mon: string;
  day_tue: string;
  day_wed: string;
  day_thu: string;
  day_fri: string;
  day_sat: string;
  day_sun: string;

  // ─── Months ───
  month_jan: string;
  month_feb: string;
  month_mar: string;
  month_apr: string;
  month_may: string;
  month_jun: string;
  month_jul: string;
  month_aug: string;
  month_sep: string;
  month_oct: string;
  month_nov: string;
  month_dec: string;

  // ─── Calls (CloserAppels) ───
  calls_title: string;
  calls_subtitle: string;
  calls_search_placeholder: string;
  calls_quick_call: string;
  calls_new_call: string;
  calls_recent: string;
  calls_finished: string;
  calls_no_calls: string;
  calls_no_calls_desc: string;
  calls_details: string;
  calls_delete_confirm: string;
  calls_deleted: string;
  calls_select_prospect: string;
  calls_no_assigned_prospect: string;
  calls_prepare_call: string;
  calls_prepare_title: string;
  calls_open_meet: string;
  calls_launch_cockpit: string;
  calls_meet_link_placeholder: string;
  calls_script_saved: string;
  calls_delete_script_confirm: string;
  calls_new_script: string;
  calls_script_title_placeholder: string;
  calls_script_write_placeholder: string;
  calls_saving: string;
  calls_no_slots_to_copy: string;
  calls_ago_min: string;
  calls_ago_hours: string;
  calls_yesterday: string;
  calls_ago_days: string;
  calls_my_script: string;
  closer_appels_in_progress: string;
  closer_appels_video_call: string;
  closer_appels_step1_open_meet: string;
  closer_appels_step2_launch_cockpit: string;

  // ─── Invoices (CloserFactures) ───
  invoices_fixed_salary_title: string;
  invoices_fixed_plus_commission_title: string;
  invoices_commission_title: string;
  invoices_fixed_salary_subtitle: string;
  invoices_fixed_plus_commission_subtitle: string;
  invoices_commission_subtitle: string;
  invoices_connect_stripe: string;
  invoices_issuer_info: string;
  invoices_payment_methods: string;
  invoices_generate_invoice: string;
  invoices_period: string;
  invoices_monthly: string;
  invoices_fixed_salary: string;
  invoices_my_commission: string;
  invoices_commission_closer: string;
  invoices_commission_setter: string;
  invoices_revenue_generated: string;
  invoices_paid: string;
  invoices_pending: string;
  invoices_period_details: string;
  invoices_cash_payment: string;
  invoices_installment_payment: string;
  invoices_total: string;
  invoices_invoice_number: string;
  invoices_date_col: string;
  invoices_client_offer: string;
  invoices_amount_ttc: string;
  invoices_due_date: string;
  invoices_status_col: string;
  invoices_actions_col: string;
  invoices_overdue: string;
  invoices_link: string;
  invoices_pay: string;
  invoices_view: string;
  invoices_no_invoices_period: string;
  invoices_status_to_pay: string;
  invoices_status_in_progress: string;
  invoices_status_paid_label: string;
  invoices_status_sent: string;
  invoices_status_generated: string;
  invoices_status_late: string;
  invoices_status_waiting: string;
  invoices_status_draft: string;
  invoices_status_updated: string;
  invoices_link_copied: string;
  invoices_ca_label: string;
  invoices_deal_label: string;

  // ─── Formulas (CloserFormules) ───
  formulas_management: string;
  formulas_count: string;
  formulas_readonly: string;
  formulas_no_formulas_title: string;
  formulas_no_formulas_desc: string;
  formulas_active: string;
  formulas_inactive: string;
  formulas_on_quote: string;
  formulas_per_month: string;
  formulas_one_time: string;
  formulas_per_year: string;
  formulas_resources_count: string;
  formulas_open: string;
  formulas_no_resources: string;
  formulas_detail_title: string;
  formulas_label_name: string;
  formulas_label_price: string;
  formulas_label_description: string;
  formulas_new_formula: string;
  formulas_create_formula: string;
  formulas_create_first_desc: string;
  formulas_edit_formula: string;
  formulas_name_required: string;
  formulas_modified: string;
  formulas_created: string;
  formulas_network_error: string;
  formulas_deactivated: string;
  formulas_activated: string;
  formulas_delete_confirm: string;
  formulas_deleted: string;
  formulas_select_pdf: string;
  formulas_upload_error: string;
  formulas_pdf_uploaded: string;
  formulas_formula_name_label: string;
  formulas_formula_name_placeholder: string;
  formulas_price_label: string;
  formulas_billing_type_label: string;
  formulas_billing_one_time: string;
  formulas_billing_subscription: string;
  formulas_billing_quote: string;
  formulas_subscription_pricing: string;
  formulas_monthly_price_label: string;
  formulas_quarterly_price_label: string;
  formulas_quarterly_hint: string;
  formulas_per_quarter: string;
  formulas_yearly_price_label: string;
  formulas_yearly_hint: string;
  formulas_stripe_connected: string;
  formulas_stripe_not_connected: string;
  formulas_stripe_connected_desc: string;
  formulas_stripe_not_connected_desc: string;
  formulas_description_label: string;
  formulas_description_placeholder: string;
  formulas_team_assigned: string;
  formulas_all_team: string;
  formulas_team_hint: string;
  formulas_resources_included: string;
  formulas_add_resource: string;
  formulas_no_resources_hint: string;
  formulas_no_resources_member: string;
  formulas_pdf_uploaded_link: string;
  formulas_change: string;
  formulas_uploading: string;
  formulas_upload_pdf: string;
  formulas_commission_label: string;
  formulas_closing_label: string;
  formulas_setting_label: string;
  formulas_advanced: string;
  formulas_customized: string;
  formulas_reset_role_rate: string;
  formulas_close_btn: string;
  formulas_cancel_btn: string;
  formulas_save_btn: string;
  formulas_create_btn: string;
  formulas_error: string;

  // ─── Appointments (CloserRendezVous) ───
  appointments_my_title: string;
  appointments_assigned_count: string;
  appointments_all_statuses: string;
  appointments_date_from: string;
  appointments_date_to: string;
  appointments_reset_filters: string;
  appointments_no_appointments_title: string;
  appointments_no_assigned: string;
  appointments_no_matching_filters: string;
  appointments_date_time: string;
  appointments_contact: string;
  appointments_email: string;
  appointments_campaign: string;
  appointments_duration: string;
  appointments_status: string;
  appointments_reassign: string;
  appointments_mark_done: string;
  appointments_reassign_title: string;
  appointments_reassign_desc: string;
  appointments_no_member_available: string;
  appointments_confirm_reassign: string;
  appointments_reassigned: string;
  appointments_reassign_error: string;
  appointments_status_updated: string;
  appointments_time_past: string;
  appointments_time_soon: string;
  appointments_time_ongoing: string;
  appointments_time_future: string;
  appointments_at_time: string;
  appointments_at_member: string;

  // ─── BusinessAppointments (Owner page) ───
  appointments_timing_1d: string;
  appointments_timing_10h: string;
  appointments_timing_5h: string;
  appointments_timing_3h: string;
  appointments_timing_1h: string;
  appointments_timing_30m: string;
  appointments_timing_15m: string;
  appointments_timing_now: string;
  appointments_var_lead_name: string;
  appointments_var_assignee_name: string;
  appointments_var_title: string;
  appointments_var_date: string;
  appointments_var_time: string;
  appointments_var_meet_link: string;
  appointments_var_reschedule_link: string;
  appointments_var_cancel_link: string;
  appointments_new_reminder: string;
  appointments_reminder_subject: string;
  appointments_manual_reminder: string;
  appointments_reminder_updated: string;
  appointments_reminder_created: string;
  appointments_save_error: string;
  appointments_reminder_deleted: string;
  appointments_reminder_enabled: string;
  appointments_reminder_disabled: string;
  appointments_send_reminder_error: string;
  appointments_reminder_sent_to: string;
  appointments_send_error: string;
  appointments_create_error: string;
  appointments_booking_link_created: string;
  appointments_link_deleted: string;
  appointments_update_error: string;
  appointments_link_updated: string;
  appointments_link_copied: string;
  appointments_deleted: string;
  appointments_delete_error: string;
  appointments_date_time_required: string;
  appointments_created_with_meet: string;
  appointments_created: string;
  appointments_configure_reminders: string;
  appointments_manage_personal: string;
  appointments_all_team: string;
  appointments_manage_calendar: string;
  appointments_tab_personal: string;
  appointments_tab_member: string;
  appointments_all_members: string;
  appointments_status_all: string;
  appointments_book_rdv: string;
  appointments_new_rdv: string;
  appointments_schedule_new: string;
  appointments_event_title: string;
  appointments_label_date: string;
  appointments_label_time: string;
  appointments_assign_to: string;
  appointments_for_me: string;
  appointments_internal_notes: string;
  appointments_enable_google_meet: string;
  appointments_connect_google_calendar: string;
  appointments_confirm_rdv: string;
  appointments_edit_reminder: string;
  appointments_email_reminders: string;
  appointments_configure_reminder_desc: string;
  appointments_auto_reminders_desc: string;
  appointments_manual_reminder_label: string;
  appointments_custom: string;
  appointments_standard: string;
  appointments_sent_manually_desc: string;
  appointments_configure_manual_reminder: string;
  appointments_auto_reminders: string;
  appointments_no_auto_reminders: string;
  appointments_add_auto_reminder: string;
  appointments_reminder_name: string;
  appointments_when_to_send: string;
  appointments_manual_reminder_desc: string;
  appointments_template_type: string;
  appointments_sender_name: string;
  appointments_email_always_from: string;
  appointments_email_subject: string;
  appointments_available_variables: string;
  appointments_html_content: string;
  appointments_preview: string;
  appointments_update: string;
  appointments_create_reminder: string;
  appointments_will_appear_here: string;

  // ─── Availability (CloserDisponibilite) ───
  availability_subtitle: string;
  availability_weekly_slots: string;
  availability_unavailable: string;
  availability_add_slot_btn: string;
  availability_add_short: string;
  availability_cancel: string;
  availability_copy_to: string;
  availability_weekend: string;
  availability_absences_title: string;
  availability_no_absences: string;
  availability_start_date: string;
  availability_end_date: string;
  availability_reason_optional: string;
  availability_reason_placeholder: string;
  availability_confirm: string;
  availability_new_absence: string;
  availability_booking_settings: string;
  availability_booking_rules_desc: string;
  availability_max_per_day: string;
  availability_unlimited: string;
  availability_per_day: string;
  availability_buffer_before: string;
  availability_buffer_desc: string;
  availability_no_buffer: string;
  availability_minutes: string;
  availability_hour: string;
  availability_min_notice: string;
  availability_min_notice_desc: string;
  availability_no_delay: string;
  availability_hours_before: string;
  availability_save_settings: string;
  availability_settings_saved: string;
  availability_slot_added: string;
  availability_slot_deleted: string;
  availability_absence_added: string;
  availability_slots_copied: string;
  availability_onboarding_title: string;
  availability_onboarding_desc: string;
  availability_onboarding_step1: string;
  availability_onboarding_step2: string;
  availability_onboarding_step3: string;
  availability_onboarding_go: string;
  availability_to_time: string;

  // ─── CallRoom (CloserCallRoom) ───
  callroom_desktop_only: string;
  callroom_desktop_only_desc: string;
  callroom_back_dashboard: string;
  callroom_header: string;
  callroom_prospect_sheet: string;
  callroom_record: string;
  callroom_end: string;
  callroom_formulas_tab: string;
  callroom_resources_tab: string;
  callroom_subscription: string;
  callroom_quote: string;
  callroom_monthly_label: string;
  callroom_yearly_label: string;
  callroom_per_month: string;
  callroom_per_year: string;
  callroom_quote_desc: string;
  callroom_no_formulas: string;
  callroom_select_formula: string;
  callroom_no_resources_formula: string;
  callroom_select_formula_resources: string;
  callroom_no_script: string;
  callroom_no_title: string;
  callroom_notepad: string;
  callroom_auto_save: string;
  callroom_current_notes: string;
  callroom_no_note: string;
  callroom_notes_placeholder: string;
  callroom_send_pdf: string;
  callroom_email_address: string;
  callroom_email_placeholder: string;
  callroom_email_sent: string;
  callroom_send: string;
  callroom_download_pdf: string;
  callroom_recording_failed: string;
  callroom_loading: string;

  // ─── Organization Page ───
  org_subtitle: string;
  org_subtitle_owner: string;
  org_tab_organisation: string;
  org_tab_onboarding: string;
  org_tab_add: string;
  org_save_button: string;
  org_brand_identity: string;
  org_company_logo: string;
  org_company_logo_hint: string;
  org_company_name_label: string;
  org_company_name_placeholder: string;
  org_description_label: string;
  org_description_placeholder: string;
  org_website_label: string;
  org_contact_email_label: string;
  org_phone_label: string;
  org_address_label: string;
  org_billing_title: string;
  org_billing_subtitle: string;
  org_raison_sociale_label: string;
  org_raison_sociale_placeholder: string;
  org_siret_label: string;
  org_tva_label: string;
  org_billing_address_label: string;
  org_billing_zip_label: string;
  org_billing_city_label: string;
  org_billing_country_label: string;
  org_info_title: string;
  org_email_label: string;
  org_phone_info_label: string;
  org_address_info_label: string;
  org_no_info: string;
  org_persons: string;
  org_cancel_crop: string;
  org_validate_logo: string;
  org_logo_updated: string;
  org_logo_upload_error: string;
  org_save_success: string;
  org_save_error: string;
  org_new_tab: string;
  org_untitled: string;
  org_custom_tab_subtitle: string;
  org_section_name_placeholder: string;
  org_add_section: string;
  org_text_block: string;
  org_video_block: string;
  org_link_block: string;
  org_pdf_block: string;
  org_text_placeholder: string;
  org_video_placeholder: string;
  org_link_title_placeholder: string;
  org_upload_in_progress: string;
  org_choose_pdf: string;
  org_view_pdf: string;
  org_no_content: string;
  org_section_empty: string;
  org_empty_sections_label: string;
  org_empty_sections_desc: string;
  org_onboarding_guide: string;
  org_onboarding_guide_desc: string;
  org_onboarding_general: string;
  org_onboarding_general_desc: string;
  org_onboarding_role: string;
  org_onboarding_role_desc: string;
  org_onboarding_ack_button: string;
  org_onboarding_ack_done: string;
  org_onboarding_active_path: string;
  org_onboarding_path_blocks: string;
  org_onboarding_general_info: string;
  org_onboarding_role_info: string;
  org_no_onboarding_sections: string;
  org_no_onboarding_sections_desc: string;
  org_no_role_sections: string;
  org_no_role_sections_desc: string;
  org_no_custom_sections: string;
  org_no_custom_sections_desc: string;
  org_view: string;

  // ─── Owner Invoices Page ───
  invoices_owner_title: string;
  invoices_owner_subtitle: string;
  invoices_total_billed: string;
  invoices_total_billed_global: string;
  invoices_paid_label: string;
  invoices_pending_label: string;
  invoices_pending_count: string;
  invoices_filter_period: string;
  invoices_filter_member: string;
  invoices_filter_all_members: string;
  invoices_filter_status: string;
  invoices_filter_all_statuses: string;
  invoices_th_invoice_number: string;
  invoices_th_date: string;
  invoices_th_client: string;
  invoices_th_member: string;
  invoices_th_amount: string;
  invoices_th_due_date: string;
  invoices_th_status: string;
  invoices_th_actions: string;
  invoices_copy_payment_link: string;
  invoices_details_button: string;
  invoices_download_button: string;
  invoices_view_button: string;
  invoices_empty_title: string;
  invoices_empty_desc: string;
  invoices_pagination_of: string;
  invoices_error_toast: string;

  // ─── Team Member Dashboard ───
  dashboard_member_hello: string;
  dashboard_member_last_sync: string;
  dashboard_member_revenue: string;
  dashboard_member_ca_generated: string;
  dashboard_member_closing_rate: string;
  dashboard_member_signed_presented: string;
  dashboard_member_appointments: string;
  dashboard_member_this_month: string;
  dashboard_member_noshow_rate: string;
  dashboard_member_absences_on: string;
  dashboard_member_my_objectives: string;
  dashboard_member_view_all: string;
  dashboard_member_expired: string;
  dashboard_member_next_appointments: string;
  dashboard_member_no_appointments: string;
  dashboard_member_appointment_label: string;
  dashboard_member_my_reminders: string;
  dashboard_member_no_reminders: string;
  dashboard_member_overdue_count: string;
  dashboard_member_overdue_days: string;
  dashboard_member_deadline: string;
  dashboard_member_active_campaigns: string;
  dashboard_member_live: string;
  dashboard_member_campaign_assigned: string;
  dashboard_member_leads_total: string;
  dashboard_member_today_short: string;
  dashboard_member_tomorrow_short: string;

  // ─── Team Role Pages ───
  team_closers_label: string;
  team_setters_label: string;

  // ─── Metric Labels ───
  metric_revenue: string;
  metric_sales_count: string;
  metric_conversion_rate: string;
  metric_leads: string;
  metric_appointments: string;
  metric_noshow_rate: string;

  // ─── Stripe Match Modal ───
  stripe_match_title: string;
  stripe_match_search_by_email: string;
  stripe_match_manual_entry: string;
  stripe_match_email_placeholder: string;
  stripe_match_no_results: string;
  stripe_match_enter_ids_manually: string;
  stripe_match_no_subscription: string;
  stripe_match_per_month: string;
  stripe_match_per_year: string;
  stripe_match_customer_id: string;
  stripe_match_subscription_id: string;
  stripe_match_link_subscription: string;

  // ─── Team Role Page ───
  team_role_global_view: string;
  team_role_no_member_found: string;
  team_role_no_member_desc: string;
  team_role_in_team_since: string;
  team_role_prospects_assigned: string;
  team_role_prospects_assigned_plural: string;
  team_role_sales_count: string;
  team_role_sales_count_plural: string;
  team_role_slots_count: string;
  team_role_slots_count_plural: string;
  team_role_absences_recorded: string;
  team_role_absences_recorded_plural: string;
  team_role_global_summary: string;
  team_role_assigned_prospects: string;
  team_role_sales_label: string;
  team_role_ca_generated: string;
  team_role_conversion_rate: string;
  team_role_no_birthdate: string;
  team_role_arrival_on: string;
  team_role_connection: string;
  team_role_disconnection: string;
  team_role_connection_history: string;
  team_role_last_7_days: string;
  team_role_no_connection_history: string;
  team_role_monthly_pay_date: string;
  team_role_the_day: string;
  team_role_each_month: string;
  team_role_next_payment_on: string;
  team_role_conversion: string;
  team_role_lost: string;
  team_role_pipeline: string;
  team_role_total: string;
  team_role_availability: string;
  team_role_no_slots: string;
  team_role_no_availability_desc: string;
  team_role_absences: string;
  team_role_no_absences: string;
  team_role_upcoming_appointments: string;
  team_role_rdv: string;
  team_role_no_upcoming_appointments: string;
  team_role_confirmed: string;
  team_role_done: string;
  team_role_pending: string;
  team_role_at: string;
  team_role_day_mon: string;
  team_role_day_tue: string;
  team_role_day_wed: string;
  team_role_day_thu: string;
  team_role_day_fri: string;
  team_role_day_sat: string;
  team_role_day_sun: string;
  team_role_stage_prospect: string;
  team_role_stage_qualified: string;
  team_role_stage_followup: string;
  team_role_stage_won: string;
  team_role_stage_noshow: string;
  team_role_stage_lost: string;

  // ─── Team Kanban ───
  kanban_title: string;
  kanban_new_team: string;
  kanban_team_name_placeholder: string;
  kanban_unassigned: string;
  kanban_add: string;
  kanban_all_assigned: string;
  kanban_create_first_team: string;
  kanban_no_teams: string;
  kanban_no_role: string;
  kanban_no_members: string;
  kanban_create_error: string;
  kanban_team_created: string;
  kanban_error: string;
  kanban_team_deleted: string;
  kanban_name_updated: string;

  // ─── Reminder Bell ───
  reminder_bell_billing_approaching: string;
  reminder_bell_billing_desc: string;
  reminder_bell_today_reminders: string;
  reminder_bell_view_all: string;
  reminder_bell_no_reminders: string;
  reminder_bell_overdue: string;
  reminder_bell_mark_done: string;
  reminder_bell_hide: string;

  // ─── Misc ───
  empty_state_title: string;
  empty_state_desc: string;
  error_generic: string;
  error_network: string;
  error_unauthorized: string;
  coming_soon: string;
  beta_badge: string;

  // ─── Issuer Profiles Modal ───
  issuer_title: string; issuer_subtitle: string; issuer_add_profile: string; issuer_edit_profile: string; issuer_new_profile: string; issuer_profile_name_label: string; issuer_company_name_label: string; issuer_address_label: string; issuer_city_label: string; issuer_zip_label: string; issuer_country_label: string; issuer_siret_label: string; issuer_email_label: string; issuer_phone_label: string; issuer_default: string; issuer_no_profiles: string; issuer_delete_confirm: string; issuer_session_expired: string; issuer_save_error: string; issuer_validation_error: string;
  // ─── Payment Methods Modal ───
  payment_methods_title: string; payment_methods_add: string; payment_methods_edit_title: string; payment_methods_new_title: string; payment_methods_name_label: string; payment_methods_type_label: string; payment_methods_bank_label: string; payment_methods_bank_placeholder: string; payment_methods_iban_label: string; payment_methods_bic_label: string; payment_methods_holder_label: string; payment_methods_holder_placeholder: string; payment_methods_paypal_email_label: string; payment_methods_revtag_label: string; payment_methods_stripe_link_label: string; payment_methods_default: string; payment_methods_set_default: string; payment_methods_delete_confirm: string; payment_methods_no_methods: string; payment_methods_no_methods_desc: string; payment_methods_session_expired: string; payment_methods_save_error: string; payment_methods_name_required: string; payment_methods_name_placeholder: string;
  // ─── Export Prospects Modal ───
  export_title: string; export_filters: string; export_period_label: string; export_period_all: string; export_period_today: string; export_period_7days: string; export_period_30days: string; export_period_90days: string; export_closer_setter: string; export_status_label: string; export_offer_formula: string; export_tags_label: string; export_custom_period: string; export_date_from: string; export_date_to: string; export_columns: string; export_select_all: string; export_deselect_all: string; export_col_name: string; export_col_firstname: string; export_col_lastname: string; export_col_email: string; export_col_phone: string; export_col_company: string; export_col_stage: string; export_col_value: string; export_col_offer: string; export_col_created: string; export_col_notes: string; export_button: string; export_toast: string; export_stage_prospect: string; export_stage_qualified: string; export_stage_unqualified: string; export_stage_won: string; export_stage_followup: string; export_stage_noanswer: string; export_stage_noshow: string; export_stage_lost: string; export_stage_label_prospect: string; export_stage_label_qualified: string; export_stage_label_unqualified: string; export_stage_label_won: string; export_stage_label_followup: string; export_stage_label_noanswer: string; export_stage_label_noshow: string; export_stage_label_lost: string;
  // ─── Stripe Connect Modal ───
  stripe_connect_title: string; stripe_connect_checking: string; stripe_connect_active: string; stripe_connect_close: string; stripe_connect_disconnect: string; stripe_connect_disconnect_confirm: string; stripe_connect_connected: string; stripe_connect_btn: string; stripe_connect_redirect: string; stripe_connect_error_init: string; stripe_connect_error_server: string; stripe_connect_benefit_1: string; stripe_connect_benefit_2: string; stripe_connect_connected_desc: string;
  // ─── Issuer Profiles Modal (extra) ───
  issuer_form_title_edit: string; issuer_form_title_new: string;
  // ─── Payment Methods Modal (extra) ───
  payment_methods_form_title_edit: string; payment_methods_form_title_new: string;
  // ─── Invoice Generator Modal (extra) ───
  invoice_gen_penalty_default: string; invoice_gen_invoice_number_pdf: string; invoice_gen_from_to: string;
  // ─── Invoice Generator Modal ───
  invoice_gen_config_title: string; invoice_gen_invoice_number: string; invoice_gen_saved_profile: string; invoice_gen_manual_entry: string; invoice_gen_issuer_name: string; invoice_gen_address: string; invoice_gen_city: string; invoice_gen_zip: string; invoice_gen_country: string; invoice_gen_siret: string; invoice_gen_email: string; invoice_gen_phone: string; invoice_gen_payment_method: string; invoice_gen_bank_transfer: string; invoice_gen_other_manual_link: string; invoice_gen_stripe_toggle: string; invoice_gen_stripe_recommended: string; invoice_gen_stripe_desc: string; invoice_gen_tva_toggle: string; invoice_gen_tva_desc: string; invoice_gen_late_penalties: string; invoice_gen_annual_rate: string; invoice_gen_fixed_indemnity: string; invoice_gen_preview: string; invoice_gen_generating_stripe: string; invoice_gen_back: string; invoice_gen_validating: string; invoice_gen_validate: string; invoice_gen_edit_invoice: string; invoice_gen_doc_title: string; invoice_gen_invoice_number_label: string; invoice_gen_due_date: string; invoice_gen_closer_lines: string; invoice_gen_setter_lines: string; invoice_gen_add_closer_line: string; invoice_gen_add_setter_line: string; invoice_gen_add_product: string; invoice_gen_description: string; invoice_gen_subtitle_placeholder: string; invoice_gen_qty: string; invoice_gen_unit_price: string; invoice_gen_section_title_placeholder: string; invoice_gen_stripe_show_toggle: string; invoice_gen_penalty_mentions: string; invoice_gen_penalty_placeholder: string; invoice_gen_footer_note: string; invoice_gen_footer_placeholder: string; invoice_gen_total_ht: string; invoice_gen_total_ttc: string; invoice_gen_issuer_label: string; invoice_gen_receiver_label: string; invoice_gen_period_label: string; invoice_gen_commission_closer: string; invoice_gen_commission_setter: string; invoice_gen_col_description: string; invoice_gen_col_qty: string; invoice_gen_col_unit_price: string; invoice_gen_col_total_ht: string; invoice_gen_payment_terms: string; invoice_gen_due_label: string; invoice_gen_payment_mode: string; invoice_gen_bank_details: string; invoice_gen_tva_not_applicable: string; invoice_gen_pay_online: string; invoice_gen_scan_to_pay: string; invoice_gen_pay_now: string; invoice_gen_generated_by: string; invoice_gen_fixed_salary: string; invoice_gen_new_line: string; invoice_gen_no_commission_error: string; invoice_gen_bank_fields_error: string; invoice_gen_paypal_error: string; invoice_gen_revtag_error: string; invoice_gen_stripe_link_error: string; invoice_gen_stripe_error: string; invoice_gen_payment_server_error: string; invoice_gen_validated_toast: string; invoice_gen_validation_error: string;
  // ─── CRM Integration Modal ───
  crm_integration_title: string; crm_integration_subtitle: string; crm_integration_available: string; crm_integration_connected_label: string; crm_integration_builtin_crm: string; crm_integration_builtin_desc: string; crm_integration_webhook_url: string; crm_integration_webhook_paste: string; crm_integration_connection: string; crm_integration_connect_desc: string; crm_integration_sync_status: string; crm_integration_auto_sync: string; crm_integration_sync_now: string; crm_integration_disconnect: string; crm_integration_contacts_imported: string; crm_integration_deals_imported: string; crm_integration_records_imported: string; crm_integration_updated: string; crm_integration_stage_changes_auto: string; crm_integration_stage_mapping: string; crm_integration_select_stage: string; crm_integration_loading: string; crm_integration_api_key_label: string; crm_integration_paste_api_key: string; crm_integration_save_key: string; crm_integration_instructions: string; crm_integration_generate_api_key: string; crm_integration_generate_btn: string; crm_integration_delete_key: string; crm_integration_airtable_config: string; crm_integration_base: string; crm_integration_table: string; crm_integration_select: string; crm_integration_field_mapping: string; crm_integration_not_mapped: string; crm_integration_stage_mapping_label: string; crm_integration_save_config: string; crm_integration_saving: string; crm_integration_pipeline_mapping: string; crm_integration_select_pipeline: string; crm_integration_csv_export_title: string; crm_integration_csv_export_desc: string; crm_integration_csv_export_btn: string; crm_integration_csv_import_title: string; crm_integration_csv_import_desc: string; crm_integration_csv_importing: string; crm_integration_csv_choose_file: string; crm_integration_csv_imported: string; crm_integration_csv_skipped: string; crm_integration_csv_defaulted: string; crm_integration_csv_warning: string; crm_integration_csv_format_title: string; crm_integration_csv_col: string; crm_integration_csv_required: string; crm_integration_csv_example: string; crm_integration_csv_yes: string; crm_integration_csv_no: string; crm_integration_csv_note: string; crm_integration_csv_separator: string; crm_integration_csv_ai_title: string; crm_integration_csv_ai_desc: string; crm_integration_close_btn: string; crm_integration_save_btn: string; crm_integration_saving_btn: string; crm_integration_firstname: string; crm_integration_lastname: string; crm_integration_email_field: string; crm_integration_phone_field: string; crm_integration_company_field: string; crm_integration_stage_field: string; crm_integration_value_field: string;

  [key: string]: string;
}

export const fr: BusinessTranslations = {
  // ─── Common ───
  common_save: 'Enregistrer',
  common_cancel: 'Annuler',
  common_close: 'Fermer',
  common_delete: 'Supprimer',
  common_confirm: 'Confirmer',
  common_loading: 'Chargement...',
  common_error: 'Erreur',
  common_success: 'Succes',
  common_search: 'Rechercher',
  common_filter: 'Filtrer',
  common_export: 'Exporter',
  common_edit: 'Modifier',
  common_add: 'Ajouter',
  common_back: 'Retour',
  common_next: 'Suivant',
  common_previous: 'Precedent',
  common_yes: 'Oui',
  common_no: 'Non',
  common_all: 'Tous',
  common_none: 'Aucun',
  common_today: "Aujourd'hui",
  common_this_week: 'Cette semaine',
  common_this_month: 'Ce mois',
  common_this_year: 'Cette annee',
  common_since_forever: 'Depuis toujours',
  common_name: 'Nom',
  common_email: 'Email',
  common_phone: 'Telephone',
  common_role: 'Role',
  common_status: 'Statut',
  common_date: 'Date',
  common_actions: 'Actions',
  common_no_data: 'Aucune donnee disponible',
  common_copy: 'Copier',
  common_copied: 'Copie !',
  common_active: 'Actif',
  common_inactive: 'Inactif',
  common_online: 'En ligne',
  common_offline: 'Hors ligne',
  common_reset: 'Reinitialiser',
  common_or: 'ou',
  common_month: 'mois',
  common_quarter: 'trimestre',
  common_year: 'an',

  // ─── Sidebar ───
  sidebar_dashboard: 'Dashboard',
  sidebar_crm: 'CRM',
  sidebar_pipeline: 'Pipeline',
  sidebar_campaigns: 'Campagnes',
  sidebar_acquisition: 'Acquisition',
  sidebar_objectives: 'Objectifs',
  sidebar_formulas: 'Formules',
  sidebar_calls: 'Appels',
  sidebar_appointments: 'Rendez-vous',
  sidebar_agenda: 'Agenda',
  sidebar_reminders: 'Rappels',
  sidebar_invoices: 'Factures',
  sidebar_report: 'Rapport',
  sidebar_setter_kpi: 'KPI Setter',
  sidebar_closer_kpi: 'KPI Closer',
  sidebar_team: 'Equipe',
  sidebar_availability: 'Disponibilite',
  sidebar_revenue: 'Revenus',
  sidebar_organization: 'Organisation',
  sidebar_settings: 'Parametres',
  sidebar_logout: 'Deconnexion',
  sidebar_sales_crm: 'CRM Sales',
  sidebar_help: 'Aide',
  sidebar_personal: 'Personnel',
  sidebar_onboarding_required: 'Veuillez completer l\'onboarding pour acceder a la plateforme.',
  sidebar_secure_logout: 'Deconnexion securisee...',
  sidebar_my_org: 'Mon organisation',
  sidebar_member: 'Membre',

  // ─── Settings Modal ───
  settings_title: 'Parametres',
  settings_tab_profile: 'Profil',
  settings_tab_security: 'Securite',
  settings_tab_interface: 'Interface',
  settings_tab_devices: 'Appareils',
  settings_tab_organisation: 'Organisation',
  settings_tab_support: 'Support',
  settings_tab_delete: 'Supprimer le compte',
  settings_profile_name: 'Nom complet',
  settings_profile_phone: 'Telephone',
  settings_profile_role: 'Role',
  settings_profile_avatar: 'Photo de profil',
  settings_profile_save: 'Enregistrer',
  settings_profile_saved: 'Profil mis a jour !',
  settings_security_current_pw: 'Mot de passe actuel',
  settings_security_new_pw: 'Nouveau mot de passe',
  settings_security_confirm_pw: 'Confirmer le mot de passe',
  settings_security_change: 'Changer le mot de passe',
  settings_interface_title: 'Interface',
  settings_dark_mode: 'Mode sombre',
  settings_dark_mode_desc: 'Basculer entre le theme clair et sombre',
  settings_language: 'Langue',
  settings_language_desc: 'Choisissez la langue de l\'interface',
  settings_language_fr: 'Francais',
  settings_language_en: 'English',
  settings_dashboard_period: 'Periode du Dashboard',
  settings_dashboard_period_desc: 'Choisissez la periode par defaut pour les KPI affiches sur le dashboard.',
  settings_sidebar_order: 'Organisation de la sidebar',
  settings_sidebar_order_desc: 'Glissez-deposez les pages pour reorganiser votre sidebar.',
  settings_sidebar_reset: 'Reinitialiser',
  settings_devices_title: 'Appareils connectes',
  settings_devices_current: 'Cet appareil',
  settings_devices_revoke: 'Revoquer',
  settings_devices_none: 'Aucun appareil connecte',
  settings_org_leave: 'Quitter l\'organisation',
  settings_org_leave_desc: 'Vous perdrez l\'acces a toutes les donnees de cette organisation.',
  settings_org_leave_confirm: 'Etes-vous sur de vouloir quitter ?',
  settings_org_reset: 'Reinitialiser l\'organisation',
  settings_org_reset_desc: 'Toutes les donnees de l\'organisation seront supprimees.',
  settings_org_reset_confirm: 'Cette action est irreversible.',
  settings_support_email: 'support@closeos.fr',
  settings_support_desc: 'Contactez-nous par email pour toute question.',
  settings_delete_title: 'Supprimer le compte',
  settings_delete_desc: 'Cette action est irreversible. Toutes vos donnees seront definitivement supprimees.',
  settings_delete_confirm: 'Confirmer la suppression',
  settings_delete_export_first: 'Exporter mes donnees d\'abord',
  settings_assignable_label: 'Assignable',
  settings_assignable_desc: 'Autoriser l\'owner a vous assigner des prospects',

  // ─── Dashboard ───
  dashboard_title: 'Dashboard',
  dashboard_welcome: 'Bienvenue',
  dashboard_period_label: 'Periode',
  dashboard_total_revenue: 'Chiffre d\'affaires',
  dashboard_total_calls: 'Appels',
  dashboard_conversion_rate: 'Taux de conversion',
  dashboard_active_prospects: 'Prospects actifs',
  dashboard_new_prospects: 'Nouveaux prospects',
  dashboard_appointments_today: 'RDV aujourd\'hui',
  dashboard_team_online: 'Equipe en ligne',
  dashboard_no_data: 'Pas encore de donnees',
  dashboard_recent_activity: 'Activite recente',
  dashboard_top_performers: 'Top performers',
  dashboard_revenue_chart: 'Evolution du CA',
  dashboard_calls_chart: 'Evolution des appels',
  dashboard_hello: 'Bonjour',
  dashboard_subtitle: 'Voici l\'etat de votre activite',
  dashboard_export_report: 'Exporter',
  dashboard_export_modal_title: 'Exporter le rapport',
  dashboard_export_modal_subtitle: 'Choisissez le format et la periode, le rapport sera envoye par email.',
  dashboard_export_format: 'Format',
  dashboard_export_period: 'Periode',
  dashboard_export_period_week: 'Semaine',
  dashboard_export_period_month: 'Mois',
  dashboard_export_period_quarter: 'Trimestre',
  dashboard_export_period_year: 'Annee',
  dashboard_export_period_all: 'Depuis toujours',
  dashboard_export_send: 'Envoyer par email',
  dashboard_export_sending: 'Envoi en cours...',
  dashboard_export_success: 'Rapport envoye !',
  dashboard_export_success_desc: 'Consultez votre boite mail.',
  dashboard_export_error: 'Erreur lors de l\'envoi',
  dashboard_export_select_format: 'Selectionnez au moins un format',
  dashboard_tooltip_revenue: 'Chiffre d\'affaires total genere par les prospects gagnes (stage Gagne). Calcule en additionnant la valeur de chaque prospect signe.',
  dashboard_tooltip_pipeline: 'Valeur totale de tous les prospects actifs dans le pipeline (tous statuts confondus). Represente le potentiel commercial global en cours.',
  dashboard_tooltip_closing: 'Taux de closing : pourcentage de prospects convertis en vente. Calcule : prospects gagnes / (gagnes + perdus + no-shows ayant eu un rendez-vous).',
  dashboard_tooltip_appointments: 'Nombre total de rendez-vous planifies a venir (confirmes et en attente) a partir d\'aujourd\'hui.',
  dashboard_tooltip_objective: 'Progression vers votre objectif de chiffre d\'affaires. Calcule : revenue actuel / objectif defini x 100.',
  dashboard_tooltip_noshow: 'Taux de no-show : pourcentage de prospects absents au rendez-vous.',
  dashboard_tooltip_health: 'Sante globale basee sur le taux de closing',
  dashboard_kpi_health: 'Sante KPI',
  dashboard_health_optimal: 'Optimal',
  dashboard_health_medium: 'Moyen',
  dashboard_health_low: 'Faible',
  dashboard_objective_ca: 'Objectif CA',
  dashboard_on_track: 'En bonne voie',
  dashboard_in_progress: 'En cours',
  dashboard_active_campaigns: 'Campagnes actives',
  dashboard_active_campaigns_desc: 'Performance en temps reel des flux actifs.',
  dashboard_sales_objectives: 'Objectifs de vente',
  dashboard_objectives_desc: 'Progression mensuelle vers les objectifs.',
  dashboard_no_objectives: 'Aucun objectif defini',
  dashboard_alert_efficiency: 'Alerte Efficacite',
  dashboard_alert_efficiency_desc: 'Le taux de closing est en dessous de la moyenne. Pensez a planifier une formation.',
  dashboard_teams: 'Equipes',
  dashboard_view_team: 'Voir l\'equipe',
  dashboard_no_members: 'Aucun membre',
  dashboard_no_members_in_team: 'Aucun membre dans cette equipe',
  dashboard_no_teams: 'Aucune equipe creee',
  dashboard_revenue_generated: 'CA genere',
  dashboard_loss_reasons: 'Raisons de Perte',
  dashboard_reminder_detail: 'Detail du rappel',
  dashboard_upcoming: 'A venir',
  dashboard_title_label: 'Titre',
  dashboard_date_time: 'Date & Heure',
  dashboard_mark_done: 'Marquer comme fait',

  // ─── CRM ───
  crm_title: 'CRM',
  crm_search_placeholder: 'Rechercher un prospect...',
  crm_add_prospect: 'Ajouter un prospect',
  crm_no_prospects: 'Aucun prospect pour le moment',
  crm_status_new: 'Nouveau',
  crm_status_contacted: 'Contacte',
  crm_status_qualified: 'Qualifie',
  crm_status_proposal: 'Proposition',
  crm_status_won: 'Gagne',
  crm_status_lost: 'Perdu',
  crm_status_no_show: 'No Show',
  crm_filter_all: 'Tous',
  crm_filter_mine: 'Mes prospects',
  crm_sort_recent: 'Plus recents',
  crm_sort_name: 'Par nom',
  crm_sort_amount: 'Par montant',
  crm_assigned_to: 'Assigne a',
  crm_unassigned: 'Non assigne',
  crm_last_contact: 'Dernier contact',
  crm_created_at: 'Date de creation',
  crm_notes: 'Notes',
  crm_add_note: 'Ajouter une note',
  crm_amount: 'Montant',

  // ─── Pipeline ───
  pipeline_title: 'Pipeline',
  pipeline_owner_title: 'Pipeline Owner',
  pipeline_filter_member: 'Filtrer par membre',
  pipeline_total: 'Total',
  pipeline_drag_hint: 'Glissez-deposez pour deplacer',

  // ─── Team ───
  team_title: 'Equipe',
  team_invite: 'Inviter un membre',
  team_invite_link: 'Lien d\'invitation',
  team_members: 'Membres',
  team_role_owner: 'Owner',
  team_role_admin: 'Admin',
  team_role_hos: 'Head of Sales',
  team_role_closer: 'Closer',
  team_role_setter: 'Setter',
  team_role_setter_closer: 'Setter-Closer',
  team_seats_used: 'Sieges utilises',
  team_seats_available: 'Sieges disponibles',
  team_buy_seats: 'Acheter des sieges',
  team_remove_member: 'Retirer le membre',
  team_remove_confirm: 'Etes-vous sur ? Toutes les donnees de ce membre seront supprimees.',
  team_last_seen: 'Derniere connexion',
  team_joined: 'A rejoint le',
  team_pending_invites: 'Invitations en attente',
  team_member_count: 'membre',
  team_member_count_plural: 'membres',
  team_manage_subtitle: 'Gérez votre équipe et consultez les fiches détaillées',
  team_back_to_team: 'Retour à l\'équipe',
  team_delete: 'Supprimer',
  team_phone_updated: 'Numéro mis à jour',
  team_not_provided: 'Non renseigné',
  team_link_copied: 'Lien copié',
  team_booking_links: 'Liens de Booking',
  team_no_booking_links: 'Aucun lien de booking',
  team_copy_link: 'Copier le lien',
  team_open: 'Ouvrir',
  team_prospect_count: 'prospect',
  team_sale_count: 'vente',
  team_slot_count: 'créneau',
  team_absence_count: 'absence',
  team_status_absent: 'Absent',
  team_status_online: 'En ligne',
  team_status_offline: 'Hors ligne',
  team_no_role: 'Sans rôle',
  team_today: 'Aujourd\'hui',
  team_days: 'jour',
  team_months: 'mois',
  team_years: 'an',
  team_day_mon: 'Lundi',
  team_day_tue: 'Mardi',
  team_day_wed: 'Mercredi',
  team_day_thu: 'Jeudi',
  team_day_fri: 'Vendredi',
  team_day_sat: 'Samedi',
  team_day_sun: 'Dimanche',
  team_pipeline_stages_prospect: 'Prospect',
  team_pipeline_stages_qualified: 'Qualifié',
  team_pipeline_stages_followup: 'Follow Up',
  team_pipeline_stages_won: 'Gagné',
  team_pipeline_stages_noshow: 'No Show',
  team_pipeline_stages_lost: 'Perdu',
  team_role_change_error: 'Erreur lors du changement de rôle',
  team_role_updated: 'Rôle mis à jour',
  team_pay_date_updated: 'Date de paiement mise à jour',
  team_role_management: 'Gestion du Rôle',
  team_role_assignment: 'Assignation',
  team_scope_visibility: 'Scope de visibilité',
  team_scope_self: 'Lui-même',
  team_scope_team: 'Équipe',
  team_scope_self_desc: 'Ce membre set uniquement pour ses propres rendez-vous.',
  team_scope_team_desc: 'Ce membre set pour tous les closers de l\'équipe.',
  team_save: 'Enregistrer',
  team_compensation: 'Rémunération',
  team_compensation_type: 'Type de rémunération',
  team_comp_commission: 'Commission',
  team_comp_fixed: 'Fixe',
  team_comp_fixed_plus_commission: 'Fixe + Commission',
  team_fixed_salary_monthly: 'Salaire fixe mensuel (€)',
  team_fixed_salary_placeholder: 'ex: 2000',
  team_setter_commissions: 'Commissions setting',
  team_setter_commissions_desc: 'Compter ses commissions en tant que setter',
  team_compensation_updated: 'Rémunération mise à jour',
  team_pay_date: 'Date de paiement',
  team_pay_date_desc: 'Jour du mois pour le versement des commissions.',
  team_pay_date_day: 'Le {day} du mois',
  team_next_payment: 'Prochain paiement le',
  team_bonuses: 'Primes',
  team_bonus_add: 'Ajouter',
  team_bonus_label_placeholder: 'Libellé (ex: Prime performance Q1)',
  team_bonus_amount_placeholder: 'Montant',
  team_bonus_link_invoice: 'Liée à une facture payée (optionnel)',
  team_bonus_no_invoice: 'Aucune facture',
  team_bonus_link_invoice_desc: 'Si liée à une facture, la prime sera versée une fois la facture au statut « payé ».',
  team_bonus_cancel: 'Annuler',
  team_bonus_none: 'Aucune prime',
  team_bonus_added: 'Prime ajoutée',
  team_bonus_deleted: 'Prime supprimée',
  team_bonus_marked_paid: 'Prime marquée comme payée',
  team_bonus_mark_paid: 'Marquer comme payé',
  team_bonus_status_paid: 'Payé',
  team_bonus_status_pending: 'En attente',
  team_bonus_total: 'Total primes',
  team_connection_history: 'Dernière semaine',
  team_last_week: 'Dernière semaine',
  team_no_history: 'Aucun historique',
  team_log_in: 'Log In',
  team_log_out: 'Log Out',
  team_pipeline_distribution: 'Distribution du Pipeline',
  team_weekly_slots: 'Slots Hebdomadaires',
  team_no_slots: 'Aucun créneau configuré',
  team_unavailable: 'Indisponible',
  team_planned_absences: 'Absences prévues',
  team_no_absences: 'Aucune absence',
  team_absence_label: 'Absence',
  team_upcoming_appointments: 'Prochains Rendez-vous',
  team_no_upcoming_appointments: 'Aucun rendez-vous à venir',
  team_th_prospect: 'Prospect',
  team_th_date: 'Date',
  team_th_status: 'Statut',
  team_appt_appointment: 'RDV',
  team_appt_at_member: 'chez',
  team_appt_confirmed: 'Confirmé',
  team_appt_done: 'Terminé',
  team_appt_pending: 'En attente',
  team_label_email: 'Email',
  team_label_whatsapp: 'WhatsApp',
  team_label_birthday: 'Anniversaire',
  team_label_arrival: 'Arrivée',
  team_label_prospects: 'Prospects',
  team_label_sales: 'Ventes',
  team_label_revenue: 'CA Généré',
  team_label_conversion: 'Conversion',
  team_label_noshow: 'No Show',
  team_label_lost: 'Perdus',
  team_years_old: 'ans',
  team_delete_error: 'Erreur lors de la suppression',
  team_error: 'Erreur',

  // ─── Campaigns ───
  campaigns_title: 'Campagnes',
  campaigns_subtitle: 'Gerez vos tunnels de conversion et pages de capture depuis un tableau de bord centralise.',
  campaigns_new: 'Nouvelle campagne',
  campaigns_create: 'Creer',
  campaigns_create_first: 'Creer une campagne',
  campaigns_save: 'Enregistrer',
  campaigns_creating: 'Creation...',
  campaigns_name: 'Nom de la campagne',
  campaigns_name_required: 'Le nom est requis',
  campaigns_status: 'Statut',
  campaigns_views: 'Vues',
  campaigns_leads: 'Leads',
  campaigns_conversion: 'Conversion',
  campaigns_active: 'Active',
  campaigns_inactive: 'Inactive',
  campaigns_paused: 'En pause',
  campaigns_edit: 'Modifier',
  campaigns_duplicate: 'Dupliquer',
  campaigns_delete: 'Supprimer',
  campaigns_delete_confirm: 'Supprimer la campagne',
  campaigns_no_campaigns: 'Aucune campagne',
  campaigns_empty_desc: 'Creez votre premiere campagne pour capturer des leads',
  campaigns_created: 'Campagne creee',
  campaigns_modified: 'Campagne modifiee',
  campaigns_deleted: 'Campagne supprimee',
  campaigns_activated: 'Campagne activee',
  campaigns_deactivated: 'Campagne desactivee',
  campaigns_copied: 'copie !',
  campaigns_network_error: 'Erreur reseau',
  campaigns_creation_error: 'Erreur lors de la creation',
  campaigns_source_created: 'Source creee',
  campaigns_config_title: 'Configuration de Campagne',
  campaigns_new_title: 'Nouvelle Campagne',
  campaigns_tab_general: 'General',
  campaigns_tab_landing: 'Page de capture',
  campaigns_tab_fields: 'Champs & Options',
  campaigns_tab_qualification: 'Qualification',
  campaigns_tab_booking: 'Booking',
  campaigns_tab_assignation: 'Assignation',
  campaigns_tab_payment: 'Paiement',
  campaigns_stripe_integration: 'Intégration Stripe',
  campaigns_stripe_not_connected: 'Compte Stripe non connecté',
  campaigns_stripe_connect_first: 'Connectez votre compte Stripe pour activer les paiements.',
  campaigns_stripe_price: 'Prix',
  campaigns_stripe_currency: 'Devise',
  campaigns_stripe_fee_notice: 'CloseOS prélève 2% de frais de service sur chaque transaction.',
  campaigns_payment_timing: 'Moment du paiement',
  campaigns_payment_before: 'Avant inscription',
  campaigns_payment_after: 'Après inscription',
  campaigns_payment_before_desc: 'Le prospect paie avant de remplir le formulaire.',
  campaigns_payment_after_desc: 'Le prospect remplit le formulaire puis paie.',
  campaigns_refund_enabled: 'Remboursement activé',
  campaigns_refund_tiers: 'Paliers de remboursement',
  campaigns_refund_days_before: 'jours avant le RDV',
  campaigns_refund_percent: '% remboursé',
  campaigns_refund_add_tier: 'Ajouter un palier',
  campaigns_refund_remove_tier: 'Supprimer',
  campaigns_reschedule_enabled: 'Reprogrammation possible',
  campaigns_reschedule_free: 'Gratuite',
  campaigns_reschedule_paid: 'Payante',
  campaigns_reschedule_price: 'Prix de la reprogrammation',
  campaigns_identification: 'Identification',
  campaigns_assigned_team: 'Equipe assignee',
  campaigns_all_team: "Toute l'equipe",
  campaigns_team_hint: 'Les bookings et assignations seront limites aux membres de cette equipe.',
  campaigns_capture_type: 'Type de Capture',
  campaigns_appointment: 'Rendez-vous',
  campaigns_direct_planning: 'Planification directe',
  campaigns_registration: 'Inscription',
  campaigns_classic_form: 'Formulaire classique',
  campaigns_rdv: 'RDV',
  campaigns_source: 'Source',
  campaigns_new_source: 'Nouvelle source',
  campaigns_source_name: 'Nom de la source',
  campaigns_internal_desc: 'Description interne',
  campaigns_internal_note: 'Note interne...',
  campaigns_utm_params: 'Parametres UTM',
  campaigns_associated_formula: 'Formule associee',
  campaigns_no_formula: 'Aucune formule',
  campaigns_formula_hint: 'Les prospects captures via cette campagne seront associes a cette formule',
  campaigns_booking_with: 'Rendez-vous avec',
  campaigns_no_rdv: 'Campagne sans rendez-vous',
  campaigns_no_rdv_desc: 'Les leads captures seront assignes a un Setter pour le traitement.',
  campaigns_assign_mode: "Mode d'assignation des",
  campaigns_specific_member: 'Un membre precis',
  campaigns_all_role: 'Tout le role',
  campaigns_multiple_members: 'Plusieurs membres',
  campaigns_choose_member: 'Choisir un membre',
  campaigns_select_members: 'Selectionnez les membres a inclure :',
  campaigns_distribution: 'Distribution des rendez-vous',
  campaigns_round_robin: 'Tournante',
  campaigns_random: 'Hasard',
  campaigns_round_robin_desc: 'Les rendez-vous sont distribues a tour de role entre les membres.',
  campaigns_random_desc: 'Les rendez-vous sont assignes aleatoirement.',
  campaigns_landing_desc: 'Configurez le contenu affiche a gauche de la page de capture (cote marketing)',
  campaigns_main_title: 'Titre principal',
  campaigns_main_title_placeholder: 'Ex: Transformez chaque lead en client.',
  campaigns_subtitle_label: 'Sous-titre',
  campaigns_subtitle_placeholder: 'Ex: THE SALES OPERATING SYSTEM',
  campaigns_desc_text: 'Texte descriptif',
  campaigns_desc_text_placeholder: 'Decrivez votre offre, votre proposition de valeur...',
  campaigns_video_url: 'URL Video (YouTube, Loom...)',
  campaigns_video_hint: "Utilisez l'URL d'integration (embed). Ex: https://www.youtube.com/embed/VIDEO_ID",
  campaigns_redirect_url: 'Lien de redirection post-capture',
  campaigns_redirect_hint: 'Optionnel — Redirige le prospect vers cette URL apres soumission du formulaire',
  campaigns_popup_config: 'Configuration du Popup',
  campaigns_popup_instant: 'Apparait instantanement',
  campaigns_popup_after_3s: 'Apres 3 secondes',
  campaigns_popup_after_5s: 'Apres 5 secondes',
  campaigns_popup_after_10s: 'Apres 10 secondes',
  campaigns_popup_after_15s: 'Apres 15 secondes',
  campaigns_popup_after_30s: 'Apres 30 secondes',
  campaigns_popup_after_1m: 'Apres 1 minute',
  campaigns_popup_hint: "S'applique quand le format Popup est utilise. Le site est bloque tant que le formulaire n'est pas rempli.",
  campaigns_required_fields: 'Champs obligatoires du formulaire',
  campaigns_always_required: 'Toujours requis',
  campaigns_required: 'Obligatoire',
  campaigns_optional: 'Optionnel',
  campaigns_lead_email: 'Adresse email du lead',
  campaigns_lead_phone: 'Numero de telephone du lead',
  campaigns_custom_fields: 'Champs personnalises',
  campaigns_add_field: 'Ajouter un champ',
  campaigns_no_custom_fields: 'Aucun champ personnalise. Cliquez sur "Ajouter un champ" pour en creer.',
  campaigns_field_name: 'Nom du champ',
  campaigns_type_text: 'Texte',
  campaigns_type_number: 'Numero',
  campaigns_type_select: 'Selection',
  campaigns_select_options: 'Options de selection',
  campaigns_add_option: 'Ajouter une option',
  campaigns_enable_questionnaire: 'Activer le questionnaire',
  campaigns_enable_questionnaire_desc: 'Les prospects repondront a des questions apres avoir rempli leurs informations',
  campaigns_questionnaire_required: 'Questionnaire obligatoire',
  campaigns_questionnaire_required_desc: 'Le prospect doit repondre avant de pouvoir reserver',
  campaigns_auto_qualification: 'Qualification automatique',
  campaigns_auto_qualification_desc: 'Les reponses sont scorees et les prospects disqualifies automatiquement',
  campaigns_max_eliminatory: 'Reponses eliminatoires tolerees',
  campaigns_max_eliminatory_desc: 'Si le prospect depasse ce nombre de reponses eliminatoires, il est automatiquement classe Non-Qualifie. (0 = aucune tolerance)',
  campaigns_add_question: 'Ajouter une question',
  campaigns_no_questions: 'Aucune question configuree. Cliquez sur "Ajouter une question" pour commencer.',
  campaigns_your_question: 'Votre question...',
  campaigns_counts_in_scoring: 'Compte dans le scoring',
  campaigns_out_of_scoring: 'Hors scoring',
  campaigns_free_text: 'Texte libre',
  campaigns_single_select: 'Selection unique',
  campaigns_multiple_choice: 'Choix multiple',
  campaigns_number: 'Nombre',
  campaigns_text_no_auto_eval: 'Les reponses textuelles ne peuvent pas etre evaluees automatiquement',
  campaigns_answer_options: 'Options de reponse',
  campaigns_expected_answers: 'Reponse(s) attendue(s)',
  campaigns_eliminatory_answers: 'Reponse(s) eliminatoire(s)',
  campaigns_expected_value: 'Valeur attendue (ou range min-max)',
  campaigns_eliminatory_value: 'Valeur eliminatoire (ou range)',
  campaigns_value_or_min: 'Valeur ou Min',
  campaigns_max_optional: 'Max (optionnel)',
  campaigns_booking_duration: 'Duree du rendez-vous',
  campaigns_booking_title_label: 'Titre du rendez-vous',
  campaigns_booking_desc_label: 'Description du rendez-vous',
  campaigns_var_lead_name: 'Nom du lead',
  campaigns_var_lead_email: 'Email du lead',
  campaigns_var_lead_phone: 'Telephone du lead',
  campaigns_var_assignee_name: 'Nom du closer/setter',
  campaigns_var_formula_name: "Nom de l'offre",
  campaigns_var_campaign_name: 'Nom de la campagne',
  campaigns_embed_page_desc: 'Personnalisez et partagez votre page de capture',
  campaigns_embed_integrate_desc: 'Integrez le formulaire sur votre site',
  campaigns_code_tuto: 'Code & Tuto',
  campaigns_customize: 'Personnaliser',
  campaigns_capture_page_link: 'Lien de la page de capture',
  campaigns_open: 'Ouvrir',
  campaigns_link: 'Lien',
  campaigns_custom_link: 'Lien personnalise',
  campaigns_full_page_link: 'Lien page entiere',
  campaigns_font: 'Police',
  campaigns_primary_color: 'Couleur principale',
  campaigns_background: 'Fond',
  campaigns_text_color: 'Texte',
  campaigns_border_radius: 'Arrondi',
  campaigns_border_radius_corners: 'Arrondi des coins',
  campaigns_square: 'Carre',
  campaigns_rounded: 'Arrondi',
  campaigns_layout: 'Disposition',
  campaigns_vertical: 'Vertical',
  campaigns_horizontal: 'Horizontal',
  campaigns_copy_custom_link: 'Copier le lien personnalise',
  campaigns_live_preview: 'Apercu en temps reel',
  campaigns_how_it_works: 'Comment ca marche',
  campaigns_popup_step1_prefix: "Le popup s'affiche ",
  campaigns_popup_step1_after: 'apres',
  campaigns_popup_step1_seconds: 'secondes',
  campaigns_popup_step1_instant: 'instantanement',
  campaigns_popup_step1_suffix: ' au chargement de la page',
  campaigns_popup_step2: "Le site est bloque (scroll desactive, overlay sombre) tant que le formulaire n'est pas rempli",
  campaigns_popup_step3: 'Une fois le formulaire soumis, le popup disparait et le visiteur peut naviguer normalement',
  campaigns_popup_step4: 'Le visiteur ne reverra plus le popup grace au localStorage',
  campaigns_popup_step5_prefix: 'Collez le code juste avant la balise',
  campaigns_popup_step5_suffix: 'de votre site',
  campaigns_iframe_step1: 'Copiez le code iframe ci-dessous',
  campaigns_iframe_step2: "Collez-le dans le HTML de votre page, a l'endroit ou vous souhaitez afficher le formulaire",
  campaigns_iframe_step3: 'Ajustez la hauteur (height) si necessaire',
  campaigns_iframe_step4: "Le formulaire s'adapte automatiquement a la largeur du conteneur",
  campaigns_code_to_embed: 'Code a integrer',
  campaigns_copy_code: 'Copier le code',
  campaigns_copy_full_page_link: 'Copier lien page entiere',
  campaigns_style: 'Style',

  // ─── Acquisition ───
  acquisition_title: 'Acquisition',
  acquisition_total_views: 'Vues totales',
  acquisition_total_leads: 'Leads totaux',
  acquisition_conversion_rate: 'Taux de conversion',
  acquisition_by_campaign: 'Par campagne',
  acquisition_by_source: 'Par source',
  acquisition_chart_views: 'Vues',
  acquisition_chart_leads: 'Leads',
  acquisition_subtitle: 'Pilotage strategique des flux d\'acquisition et conversion en temps reel pour le trimestre en cours.',
  acquisition_active_campaigns: 'Campagnes Actives',
  acquisition_total_views_label: 'Vues Totales',
  acquisition_registration_rate: 'Taux Inscription',
  acquisition_leads_views: 'leads / {views} vues',
  acquisition_ca_generated: 'CA Genere',
  acquisition_clients_won: 'client gagne',
  acquisition_clients_won_plural: 'clients gagnes',
  acquisition_performance_by_campaign: 'Performance par Campagne',
  acquisition_granular_details: 'Details granulaires des flux actifs',
  acquisition_active: 'Active',
  acquisition_inactive: 'Inactive',
  acquisition_views_label: 'Vues',
  acquisition_leads_label: 'Leads',
  acquisition_conversion_rate_label: 'Taux de Conversion',
  acquisition_distribution_by_campaign: 'Repartition par campagne',
  acquisition_most_viewed: 'Plus ouverte',
  acquisition_most_converted: 'Plus convertie',
  acquisition_no_data: 'Aucune donnee',
  acquisition_views_tooltip: 'vues',
  acquisition_client_conversion: 'Conversion Client (%)',
  acquisition_ca_by_campaign: 'Chiffre d\'affaires par campagne',
  acquisition_projection_vs_actual: 'Projection brute vs realise par canal',
  acquisition_actual: 'Realise',
  acquisition_implication_rate: 'Taux d\'implication (%)',
  acquisition_implication_desc: 'Reduction des no-shows et no-answers',
  acquisition_education_rate: 'Taux d\'education (%)',
  acquisition_education_desc: 'Qualite des leads (lowest unqualified)',
  acquisition_include_noanswer_noshow: 'Inclure "Pas de reponse" et "No Show"',
  acquisition_empty_title: 'Aucune donnee d\'acquisition',
  acquisition_empty_desc: 'Creez des campagnes et partagez vos pages de capture pour voir les statistiques ici.',

  // ─── Objectives ───
  objectives_title: 'Objectifs',
  objectives_add: 'Ajouter un objectif',
  objectives_target: 'Cible',
  objectives_current: 'Actuel',
  objectives_progress: 'Progression',
  objectives_assign_to: 'Assigner a',
  objectives_type_calls: 'Appels',
  objectives_type_revenue: 'CA',
  objectives_type_prospects: 'Prospects',
  objectives_type_conversion: 'Taux de conversion',
  objectives_no_objectives: 'Aucun objectif',
  objectives_personal: 'Personnels',
  objectives_team: 'Equipe',
  objectives_cycle: 'Cycle',
  objectives_daily: 'Quotidien',
  objectives_weekly: 'Hebdomadaire',
  objectives_monthly: 'Mensuel',
  objectives_my_title: 'Mes objectifs',
  objectives_subtitle: 'Suivez et atteignez vos objectifs commerciaux.',
  objectives_new_objective: 'Nouvel objectif',
  objectives_tab_assigned: 'Assignés',
  objectives_tab_org: 'Organisation',
  objectives_tab_personal: 'Personnels',
  objectives_no_org: 'Aucun objectif d\'organisation',
  objectives_no_org_desc: 'Aucun objectif d\'organisation n\'a été défini.',
  objectives_no_assigned: 'Aucun objectif assigné',
  objectives_no_assigned_desc: 'Aucun objectif ne vous a été assigné pour le moment.',
  objectives_no_personal: 'Aucun objectif personnel',
  objectives_no_personal_desc: 'Définissez vos premiers objectifs pour suivre votre progression.',
  objectives_create_first: 'Créer mon premier objectif',
  objectives_percent_reached: 'atteint',
  objectives_overdue: 'En retard',
  objectives_deadline: 'Échéance',
  objectives_visible_to_manager: 'Visible par le manager',
  objectives_private: 'Privé',
  objectives_edit_title: 'Modifier l\'objectif',
  objectives_new_personal: 'Nouvel objectif personnel',
  objectives_label_required: 'Le titre est requis',
  objectives_label_name: 'Nom',
  objectives_label_name_placeholder: 'Ex: Atteindre 50k€ de CA',
  objectives_label_metric: 'Métrique',
  objectives_label_description: 'Description',
  objectives_label_description_placeholder: 'Décrivez votre objectif...',
  objectives_label_target: 'Valeur cible',
  objectives_label_target_placeholder: '0',
  objectives_label_period: 'Période',
  objectives_label_deadline: 'Date limite',
  objectives_visibility_visible: 'Visible',
  objectives_visibility_visible_desc: 'Visible par votre manager',
  objectives_visibility_private: 'Privé',
  objectives_visibility_private_desc: 'Seul vous pouvez voir cet objectif',
  objectives_modified: 'Objectif modifié',
  objectives_created: 'Objectif créé',
  objectives_deleted: 'Objectif supprimé',
  objectives_delete_confirm: 'Supprimer l\'objectif "{label}" ?',
  objectives_network_error: 'Erreur réseau',
  objectives_metric_revenue: 'Chiffre d\'affaires',
  objectives_metric_sales_count: 'Ventes',
  objectives_metric_conversion_rate: 'Taux de conversion',
  objectives_metric_leads: 'Leads',
  objectives_metric_appointments: 'Rendez-vous',
  objectives_metric_noshow_rate: 'Taux de no-show',
  objectives_metric_custom: 'Personnalisé',
  objectives_period_weekly: 'Hebdomadaire',
  objectives_period_monthly: 'Mensuel',
  objectives_period_quarterly: 'Trimestriel',
  objectives_period_yearly: 'Annuel',
  objectives_period_short_weekly: 'Semaine',
  objectives_period_short_monthly: 'Mois',
  objectives_period_short_quarterly: 'Trimestre',
  objectives_period_short_yearly: 'Année',
  objectives_reached_title: 'Objectif atteint',
  objectives_reached_member: 'a atteint l\'objectif',
  objectives_reached_generic: 'L\'objectif a été atteint',
  objectives_target_required: 'La valeur cible est requise',
  objectives_completed: 'Terminé',
  objectives_define_next: 'Définissez votre prochain objectif',

  // ─── Formulas ───
  formulas_title: 'Formules',
  formulas_add: 'Ajouter une formule',
  formulas_name: 'Nom',
  formulas_price: 'Prix',
  formulas_description: 'Description',
  formulas_commission: 'Commission',
  formulas_no_formulas: 'Aucune formule',
  formulas_edit: 'Modifier',
  formulas_delete: 'Supprimer',

  // ─── Appointments ───
  appointments_title: 'Rendez-vous',
  appointments_upcoming: 'A venir',
  appointments_past: 'Passes',
  appointments_no_appointments: 'Aucun rendez-vous',
  appointments_with: 'Avec',
  appointments_at: 'a',
  appointments_status_confirmed: 'Confirme',
  appointments_status_pending: 'En attente',
  appointments_status_cancelled: 'Annule',
  appointments_status_done: 'Termine',
  appointments_status_no_show: 'No Show',
  appointments_add: 'Ajouter un rendez-vous',
  appointments_reschedule: 'Reporter',
  appointments_cancel: 'Annuler',

  // ─── Agenda ───
  agenda_title: 'Agenda',
  agenda_today: "Aujourd'hui",
  agenda_week: 'Semaine',
  agenda_no_events: 'Aucun evenement',

  // ─── Reminders ───
  reminders_title: 'Rappels',
  reminders_add: 'Ajouter un rappel',
  reminders_no_reminders: 'Aucun rappel',
  reminders_due: 'A faire',
  reminders_overdue: 'En retard',
  reminders_completed: 'Termine',
  reminders_tomorrow: 'Demain',
  reminders_yesterday: 'Hier',
  reminders_status_upcoming: 'Upcoming',
  reminders_status_overdue: 'Passé',
  reminders_status_done: 'Fait',
  reminders_created_toast: 'Rappel créé',
  reminders_create_error: 'Impossible de créer le rappel',
  reminders_page_title: 'Rappels',
  reminders_total_count: 'rappel',
  reminders_late_count: 'en retard',
  reminders_overdue_alert: 'Attention : Vous avez des rappels critiques qui n\'ont pas été traités depuis plus de 24h.',
  reminders_view_urgent: 'Voir les urgences',
  reminders_team_all: 'Équipe : Tous',
  reminders_reset_filters: 'Réinitialiser',
  reminders_new_reminder: 'Nouveau rappel',
  reminders_all_up_to_date: 'Tout est à jour',
  reminders_no_reminders_desc: 'Vous n\'avez aucun rappel prévu pour le moment. Détendez-vous ou créez-en un nouveau.',
  reminders_add_reminder: 'Ajouter un rappel',
  reminders_header_title: 'Titre',
  reminders_header_description: 'Description',
  reminders_header_datetime: 'Date & heure',
  reminders_header_assigned: 'Assigné',
  reminders_header_linked: 'Lié à',
  reminders_header_status: 'Statut',
  reminders_header_actions: 'Actions',
  reminders_me: 'Moi',
  reminders_myself: 'Moi-même',
  reminders_detail_title: 'Détail du rappel',
  reminders_label_title: 'Titre',
  reminders_label_description: 'Description',
  reminders_label_datetime: 'Date & Heure',
  reminders_at_time: 'à',
  reminders_label_assigned_to: 'Assigné à',
  reminders_member: 'Membre',
  reminders_label_linked_prospect: 'Prospect lié',
  reminders_view_card: 'Voir la fiche →',
  reminders_label_created_at: 'Créé le',
  reminders_mark_done: 'Marquer comme fait',
  reminders_delete: 'Supprimer',
  reminders_modal_title: 'Nouveau rappel',
  reminders_modal_subtitle: 'Planifiez une tâche ou un suivi',
  reminders_form_title: 'Titre *',
  reminders_form_title_placeholder: 'Ex: Rappeler le prospect',
  reminders_form_description: 'Description',
  reminders_form_description_placeholder: 'Détails optionnels...',
  reminders_form_date: 'Date *',
  reminders_form_time: 'Heure *',
  reminders_form_assign_to: 'Assigner à',
  reminders_form_myself_option: '— Moi-même —',
  reminders_form_link_to: 'Lier à',
  reminders_form_link_none: 'Aucun',
  reminders_form_link_prospect: 'Un prospect',
  reminders_form_search_prospect: 'Rechercher un prospect...',
  reminders_form_no_prospect_found: 'Aucun prospect trouvé',
  reminders_form_linked_to: 'Lié à :',
  reminders_form_submit: 'Créer le rappel',

  // ─── Invoices ───
  invoices_title: 'Factures',
  invoices_create: 'Creer une facture',
  invoices_no_invoices: 'Aucune facture',
  invoices_amount: 'Montant',
  invoices_date: 'Date',
  invoices_status_paid: 'Payee',
  invoices_status_pending: 'En attente',
  invoices_status_overdue: 'En retard',
  invoices_client: 'Client',
  invoices_download: 'Telecharger',
  invoices_org_title: 'Factures de l\'organisation',

  // ─── Report ───
  report_title: 'Rapport',
  report_export_pdf: 'Exporter en PDF',
  report_period: 'Periode',
  report_summary: 'Resume',
  report_by_member: 'Par membre',
  report_by_offer: 'Par offre',
  report_total_revenue: 'CA total',
  report_total_calls: 'Appels totaux',
  report_conversion_rate: 'Taux de conversion',
  report_mmr_title: 'Monday Morning Reporting',
  report_7_days: '7 jours',
  report_14_days: '14 jours',
  report_30_days: '30 jours',
  report_90_days: '90 jours',
  report_6_months: '6 mois',
  report_1_year: '1 an',
  report_all_time: 'Tout',
  report_subtitle: 'Visualisez la performance globale de vos campagnes et de votre équipe commerciale en temps réel.',
  report_export_pdf_btn: 'Export PDF',
  report_ca_generated: 'CA Généré',
  report_sales: 'Ventes',
  report_avg_short: 'moy.',
  report_closing_rate: 'Taux de Closing',
  report_closing_rate_high: 'High',
  report_closing_rate_normal: 'Normal',
  report_closing_rate_low: 'Low',
  report_estimated_commission: 'Commission estimée',
  report_total_leads: 'Total Leads',
  report_show_up: 'Show Up',
  report_no_show: 'No Show',
  report_loss_rate: 'Taux de perte',
  report_you: 'Vous',
  report_member: 'Membre',
  report_added_prospect: 'a ajouté un prospect',
  report_closed_sale: 'a conclu une vente',
  report_lost_deal: 'a perdu un deal',
  report_marked_noshow: 'a marqué un no-show',
  report_modified_pipeline: 'a modifié le pipeline',
  report_scheduled_appointment: 'a fixé un rendez-vous',
  report_scheduled_reminder: 'a programmé un rappel',
  report_activity_feed_today: "Fil d'activité — Aujourd'hui",
  report_all_members: 'Tous les membres',
  report_me_owner: 'Moi (Owner)',
  report_no_activity_today: "Aucune activité aujourd'hui",
  report_leads_by_stage: 'Répartition des leads par étape',
  report_no_data: 'Aucune donnée',
  report_ca_by_campaign: 'CA par campagne',
  report_loss_reasons: 'Raisons de Perte',
  report_autre_detail_title: 'Détail des motifs « Autre »',
  report_result: 'résultat',
  report_results: 'résultats',
  report_all_campaigns: 'Toutes les campagnes',
  report_all_closers: 'Tous les closers',
  report_all_teams: 'Toutes les équipes',
  report_no_autre_found: 'Aucun motif « Autre » trouvé',
  report_try_modify_filters: 'Essayez de modifier les filtres',
  report_reason: 'Motif',
  report_prospect: 'Prospect',
  report_closer: 'Closer',
  report_campaign_performance: 'Performance des Campagnes',
  report_no_campaign: 'Aucune campagne',
  report_campaign: 'Campagne',
  report_status: 'Statut',
  report_date: 'Date',
  report_views: 'Vues',
  report_conv: 'Conv.',
  report_ca: 'CA',
  report_commission: 'Commission',
  report_active: 'Active',
  report_paused: 'Paused',
  report_total: 'Total',
  report_team_performance: "Performance de l'Équipe",
  report_no_team_member: "Aucun membre dans l'équipe",
  report_wins: 'Wins',
  report_financial_summary: 'Résumé Financier',
  report_avg_deal: 'Panier Moyen',
  report_show_up_rate: 'Show Up Rate',
  report_appointments: 'Rendez-vous',
  report_total_short: 'total',
  report_done: 'terminé',
  report_done_plural: 'terminés',
  report_total_rdv: 'Total RDV',
  report_completed: 'Terminés',
  report_pending: 'En attente',
  report_confirmed: 'Confirmés',
  report_cancelled: 'Annulés',
  report_show_up_rate_label: 'Taux Show Up',
  report_detailed_pipeline: 'Pipeline Détaillé',
  report_total_value: 'Valeur totale :',
  report_prospects: 'Prospects',
  report_won: 'Gagnés',
  report_stage_new_lead: 'Nouveau Lead',
  report_stage_qualified: 'Qualifié',
  report_stage_unqualified: 'Non-Qualifié',
  report_stage_followup: 'Follow Up',
  report_stage_won: 'Gagné',
  report_stage_lost: 'Perdu',
  report_stage_no_answer: 'Pas de Réponse',
  report_stage_no_show: 'No Show',
  report_pdf_title: 'CloseOS Business — Rapport',
  report_pdf_period: 'Période :',
  report_pdf_generated_on: 'Généré le',
  report_pdf_closing: 'Closing',
  report_pdf_pipeline_distribution: 'Répartition Pipeline',
  report_pdf_campaign_performance: 'Performance Campagnes',
  report_pdf_registered: 'Inscrits',
  report_pdf_inactive: 'Inactive',
  report_pdf_team: 'Équipe',
  report_pdf_members: 'membres',
  report_pdf_member_col: 'Membre',
  report_pdf_role: 'Rôle',
  report_pdf_email: 'Email',
  report_pdf_since: 'Depuis',
  report_pdf_appointments: 'Rendez-vous',
  report_pdf_total: 'Total :',
  report_pdf_done: 'Terminés :',
  report_pdf_cancelled: 'Annulés :',
  report_pdf_show_up: 'Show Up :',
  report_pdf_footer: 'CloseOS Business · Rapport généré automatiquement',
  report_not_specified: 'Non précisé',
  report_not_assigned: 'Non assigné',

  // ─── KPI ───
  kpi_title: 'KPI',
  kpi_setter_title: 'KPI Setter',
  kpi_closer_title: 'KPI Closer',
  kpi_calls_made: 'Appels effectues',
  kpi_calls_answered: 'Appels repondus',
  kpi_conversion: 'Conversion',
  kpi_revenue: 'CA',
  kpi_avg_call_duration: 'Duree moyenne d\'appel',
  kpi_appointments_set: 'RDV programmes',
  kpi_no_show_rate: 'Taux de no-show',
  kpi_by_offer: 'Par offre',
  kpi_evolution: 'Evolution',
  kpi_period: 'Periode',
  kpi_ca_generated: 'CA Genere',
  kpi_total_sales: 'Ventes Totales',
  kpi_conversion_rate: 'Taux de Conversion',
  kpi_active_prospects: 'Prospects Actifs',
  kpi_noshow_rate: 'Taux de No Show',
  kpi_deals_lost: 'Deals Perdus',
  kpi_followup_rate: 'Taux de Follow-up',
  kpi_r2_closing_rate: 'Closing après R2',
  kpi_total_leads: 'Total Leads',
  kpi_deals_in_progress: 'Deals en Cours',
  kpi_avg_value: 'Valeur Moyenne',
  kpi_closing_rate_history: 'Historique Taux de Closing',
  kpi_ca_history: 'Historique CA par Mois',
  kpi_loss_reasons: 'Raisons de Perte',
  kpi_closing_rate_tooltip: 'Taux de closing',
  kpi_ca_tooltip: 'CA',
  kpi_tab_global: 'Global',
  kpi_tab_period: 'Par Periode',
  kpi_tab_member: 'Par Membre',
  kpi_tab_team: 'Par Equipe',
  kpi_all_members: 'Tous les membres',
  kpi_performance_by_member: 'Performance par Membre',
  kpi_click_member_detail: 'Cliquez sur un membre pour voir ses KPIs detailles.',
  kpi_header_name: 'Nom',
  kpi_header_role: 'Role',
  kpi_header_prospects: 'Prospects',
  kpi_header_sales: 'Ventes',
  kpi_header_ca: 'CA',
  kpi_header_conv_rate: 'Taux Conv.',
  kpi_you_owner: 'Vous (Owner)',
  kpi_no_team_members: 'Aucun membre dans l\'equipe. Invitez des membres depuis la page Equipe.',
  kpi_back_to_list: 'Retour a la liste',
  kpi_commission_10: 'Commission (10%)',
  kpi_commission_history: 'Historique Commissions',
  kpi_no_data_yet: 'Pas encore de donnees',
  kpi_avg_commission: 'Com. Moyenne',
  kpi_stage_distribution: 'Repartition par Stage',
  kpi_loss_reasons_period: 'Raisons de Perte',
  kpi_stage_followup: 'Follow-up',
  kpi_stage_noshow: 'No Show',
  kpi_stage_unqualified: 'Non-Qualifie',
  kpi_stage_noanswer: 'Pas de Reponse',
  kpi_team_members_count: 'membre',
  kpi_no_members_in_team: 'Aucun membre dans cette equipe',
  kpi_performance_setter: 'Performance Setter',
  kpi_performance_closer: 'Performance Closer',
  kpi_team_overview: 'Vue d\'ensemble',
  kpi_your_performance: 'Votre performance',
  kpi_configure: 'Configurer',
  kpi_export_pdf: 'Exporter PDF',
  kpi_period_label: 'Periode',
  kpi_reset: 'Reinitialiser',
  kpi_all_periods: 'Toutes les periodes',
  kpi_tab_org: 'Organisation',
  kpi_tab_by_formula: 'Par Formule',
  kpi_tab_by_campaign: 'Par Campagne',
  kpi_tab_by_source: 'Par Source',
  kpi_tab_personal: 'Personnel',
  kpi_no_formula: 'Aucune formule',
  kpi_no_campaign: 'Aucune campagne',
  kpi_no_source: 'Aucune source',
  kpi_response_rate: 'Taux de reponse',
  kpi_booking_rate: 'Taux de booking',
  kpi_responses_contacted: 'Reponses / Contactes',
  kpi_booked_contacted: 'Bookes / Contactes',
  kpi_closing_rate: 'Taux de closing',
  kpi_won_qualified: 'Gagnes / Qualifies',
  kpi_noshow_qualified: 'No-show / Qualifies',
  kpi_my_commissions: 'Mes commissions',
  kpi_commissions: 'Commissions',
  kpi_closing_rate_chart: 'Taux de closing',
  kpi_commission_chart: 'Commissions',
  kpi_pipeline_summary: 'Pipeline',
  kpi_avg_comm: 'Com. Moyenne',
  kpi_config_title: 'Configuration KPI',
  kpi_revenue_target: 'Objectif CA',
  kpi_planned_calls: 'Appels prevus',
  kpi_commission_rate: 'Taux de commission',
  kpi_save_error: 'Erreur lors de la sauvegarde',
  kpi_config_saved: 'Configuration sauvegardee',
  kpi_pdf_exported: 'PDF exporte',
  kpi_pdf_export_error: 'Erreur lors de l\'export PDF',
  kpi_exported_on: 'Exporte le',
  kpi_org_kpis: 'KPIs Organisation',
  kpi_autre_details_title: 'Details "Autre"',
  kpi_autre_results: 'resultats',
  kpi_all_closers: 'Tous les closers',
  kpi_all_teams: 'Toutes les equipes',
  kpi_autre_header_motif: 'Motif',
  kpi_autre_header_prospect: 'Prospect',
  kpi_autre_header_closer: 'Closer',
  kpi_autre_header_date: 'Date',
  kpi_no_autre_found: 'Aucun resultat "Autre" trouve',
  kpi_try_change_filters: 'Essayez de modifier les filtres',
  kpi_not_specified: 'Non specifie',
  kpi_not_assigned: 'Non assigne',
  kpi_by_formula_label: 'Par Formule',
  kpi_by_campaign_label: 'Par Campagne',
  kpi_by_source_label: 'Par Source',
  kpi_month_jan: 'Janvier',
  kpi_month_feb: 'Fevrier',
  kpi_month_mar: 'Mars',
  kpi_month_apr: 'Avril',
  kpi_month_may: 'Mai',
  kpi_month_jun: 'Juin',
  kpi_month_jul: 'Juillet',
  kpi_month_aug: 'Aout',
  kpi_month_sep: 'Septembre',
  kpi_month_oct: 'Octobre',
  kpi_month_nov: 'Novembre',
  kpi_month_dec: 'Decembre',
  kpi_tab_by_team: 'Par Equipe',
  kpi_stage_distribution_period: 'Repartition par Stage',
  kpi_bar_prospects: 'Prospects',

  // ─── Revenue ───
  revenue_title: 'Revenus',
  revenue_total: 'Total',
  revenue_monthly: 'Ce mois',
  revenue_by_member: 'Par membre',
  revenue_by_offer: 'Par offre',
  revenue_chart: 'Graphique',
  revenue_stripe_connect: 'Connecter Stripe',
  revenue_payments: 'Paiements',
  revenue_period_this_month: 'Ce mois-ci',
  revenue_period_3m: '3 mois',
  revenue_period_6m: '6 mois',
  revenue_period_this_year: 'Cette année',
  revenue_period_all: 'Tout',
  revenue_tab_revenue: 'Revenus',
  revenue_tab_charges: 'Charges',
  revenue_tab_margin: 'Marge',
  revenue_connect_stripe_title: 'Connecter Stripe',
  revenue_connect_stripe_desc: 'Synchronisez vos abonnements et paiements Stripe pour un suivi automatique.',
  revenue_connect_btn: 'Connecter Stripe',
  revenue_stripe_syncing: 'Synchronisation en cours...',
  revenue_resync_stripe: 'Re-synchroniser Stripe',
  revenue_disconnect_stripe: 'Déconnecter Stripe',
  revenue_disconnect_confirm: 'Êtes-vous sûr de vouloir déconnecter Stripe ?',
  revenue_stripe_disconnected: 'Stripe déconnecté',
  revenue_stripe_disconnect_error: 'Erreur lors de la déconnexion',
  revenue_stripe_connected_success: 'Stripe connecté avec succès',
  revenue_load_error: 'Erreur de chargement des revenus',
  revenue_charge_added: 'Charge ajoutée',
  revenue_ca_label: 'CA',
  revenue_net_margin: 'Marge Nette',
  revenue_new_clients: 'Nouveaux clients',
  revenue_cancellations: 'Résiliations',
  revenue_churn: 'Churn',
  revenue_active_subscriptions: 'Abonnements actifs',
  revenue_no_active_sub: 'Aucun abonnement actif',
  revenue_connect_stripe_to_see: 'Connectez Stripe pour voir vos abonnements',
  revenue_sub_active: 'Actif',
  revenue_sub_trial: 'Essai',
  revenue_per_month: 'mois',
  revenue_per_year: 'an',
  revenue_team_commissions: 'Commissions équipe',
  revenue_no_commission: 'Aucune commission ce mois-ci',
  revenue_fixed_salary: 'Salaire fixe',
  revenue_commission_label: 'Commission',
  revenue_fixed_charges: 'Charges fixes',
  revenue_variable_charges: 'Charges variables',
  revenue_no_fixed_charge: 'Aucune charge fixe',
  revenue_no_variable_charge: 'Aucune charge variable',
  revenue_label_placeholder: 'Libellé',
  revenue_amount_placeholder: 'Montant',
  revenue_monthly_evolution: 'Évolution mensuelle',
  revenue_commissions_breakdown: 'Détail des commissions',
  revenue_stripe_benefit_1: 'Synchronisation automatique des abonnements',
  revenue_stripe_benefit_2: 'Suivi du MRR et du churn en temps réel',
  revenue_stripe_benefit_3: 'Historique complet des paiements',
  revenue_stripe_connected_desc: 'Votre compte Stripe est connecté. Les données sont synchronisées automatiquement.',
  revenue_sync_created: '{created} abonnements créés, {matched} associés',
  revenue_error: 'Une erreur est survenue',
  revenue_month_jan: 'Janv',
  revenue_month_feb: 'Fév',
  revenue_month_mar: 'Mars',
  revenue_month_apr: 'Avr',
  revenue_month_may: 'Mai',
  revenue_month_jun: 'Juin',
  revenue_month_jul: 'Juil',
  revenue_month_aug: 'Août',
  revenue_month_sep: 'Sept',
  revenue_month_oct: 'Oct',
  revenue_month_nov: 'Nov',
  revenue_month_dec: 'Déc',

  // ─── Call Room ───
  callroom_title: 'Cockpit d\'appel',
  callroom_script: 'Script',
  callroom_notes: 'Notes',
  callroom_offer: 'Offre',
  callroom_resources: 'Ressources',
  callroom_start_call: 'Demarrer l\'appel',
  callroom_end_call: 'Terminer l\'appel',
  callroom_recording: 'Enregistrement',
  callroom_prospect_info: 'Infos prospect',
  callroom_save_notes: 'Sauvegarder les notes',
  callroom_result: 'Resultat de l\'appel',
  callroom_result_sold: 'Vente',
  callroom_result_not_sold: 'Pas de vente',
  callroom_result_callback: 'Rappel',
  callroom_result_no_show: 'No Show',
  callroom_result_cancelled: 'Annule',

  // ─── Call Details ───
  calldetails_title: 'Details de l\'appel',
  calldetails_duration: 'Duree',
  calldetails_recording: 'Enregistrement',
  calldetails_notes: 'Notes',
  calldetails_result: 'Resultat',
  calldetails_prospect: 'Prospect',
  calldetails_date: 'Date',
  calldetails_offer: 'Offre',

  // ─── Availability ───
  availability_title: 'Disponibilite',
  availability_add_slot: 'Ajouter un creneau',
  availability_no_slots: 'Aucun creneau',
  availability_absences: 'Absences',
  availability_add_absence: 'Ajouter une absence',
  availability_from: 'Du',
  availability_to: 'Au',
  availability_reason: 'Motif',

  // ─── Organization ───
  org_title: 'Organisation',
  org_company_name: 'Nom de l\'entreprise',
  org_logo: 'Logo',
  org_description: 'Description',
  org_website: 'Site web',
  org_address: 'Adresse',
  org_phone: 'Telephone',
  org_email: 'Email',
  org_billing_info: 'Informations de facturation',
  org_raison_sociale: 'Raison sociale',
  org_subscription: 'Abonnement',
  org_plan: 'Formule',
  org_manage_subscription: 'Gerer l\'abonnement',

  // ─── Onboarding ───
  onboarding_welcome: 'Bienvenue sur CloseOS Business !',
  onboarding_step: 'Etape',
  onboarding_company_name: 'Nom de votre entreprise',
  onboarding_team_size: 'Taille de votre equipe',
  onboarding_niche: 'Votre niche',
  onboarding_finish: 'Terminer',
  onboarding_skip: 'Passer',
  onboarding_tm_welcome: 'Bienvenue chez {company} !',
  onboarding_tm_welcome_fallback: 'votre organisation',
  onboarding_tm_subtitle: 'Completez votre profil pour commencer',
  onboarding_tm_first_name: 'Prenom',
  onboarding_tm_last_name: 'Nom',
  onboarding_tm_dob: 'Date de naissance',
  onboarding_tm_phone: 'Telephone',
  onboarding_tm_years_old: '{age} ans',
  onboarding_tm_finish: 'Terminer',
  onboarding_tm_cancel_crop: 'Annuler',
  onboarding_tm_validate_photo: 'Valider la photo',
  onboarding_owner_profile_title: 'Votre profil',
  onboarding_owner_profile_subtitle: 'Presentez-vous en quelques secondes',
  onboarding_owner_full_name: 'Nom complet',
  onboarding_owner_phone: 'Telephone',
  onboarding_owner_role: 'Votre role',
  onboarding_owner_continue: 'Continuer',
  onboarding_owner_company_title: 'Votre entreprise',
  onboarding_owner_company_subtitle: 'Configurez votre espace Business',
  onboarding_owner_company_name: 'Nom de l\'entreprise',
  onboarding_owner_company_placeholder: 'Mon entreprise',
  onboarding_owner_team_size: 'Taille de l\'equipe',
  onboarding_owner_niche_sector: 'Niche / Secteur',
  onboarding_owner_niche_custom_placeholder: 'Precisez votre secteur...',
  onboarding_owner_back: 'Retour',
  onboarding_owner_cancel_crop: 'Annuler',
  onboarding_owner_validate_photo: 'Valider la photo',

  // ─── Login ───
  login_title: 'Connexion',
  login_email: 'Email',
  login_password: 'Mot de passe',
  login_submit: 'Se connecter',
  login_google: 'Continuer avec Google',
  login_no_account: 'Pas encore de compte ?',
  login_register: 'S\'inscrire',
  login_forgot: 'Mot de passe oublie ?',
  login_subtitle: 'Gerez vos campagnes et actifs avec CloseOS Business.',
  login_email_placeholder: 'Pseudo ou email',
  login_or_continue: 'Ou continuer avec',
  login_create_account: 'Creer un compte',
  login_help: 'Aide',
  login_privacy: 'Confidentialite',
  login_terms: 'CGV',
  login_all_rights: 'Tous droits reserves.',
  login_code_title: 'Connexion par code',
  login_code_subtitle: 'Entrez votre email pour recevoir un code de connexion.',
  login_code_send: 'Envoyer le code',
  login_code_back: 'Retour',
  login_code_enter_title: 'Entrez le code',
  login_code_enter_subtitle: 'Un code a 6 chiffres a ete envoye a',
  login_code_resend: 'Renvoyer le code',
  login_code_resend_countdown: 'Renvoyer ({seconds}s)',
  login_code_change_email: 'Changer d\'email',
  login_code_sent: 'Code envoye a {email}',
  login_code_new_sent: 'Nouveau code envoye !',
  login_code_resend_error: 'Erreur lors du renvoi.',
  login_code_invalid: 'Code invalide',
  login_code_send_error: 'Erreur lors de l\'envoi',
  login_code_connection_error: 'Erreur de connexion. Veuillez reessayer.',
  login_error_generic: 'Une erreur est survenue.',
  login_error_google: 'Impossible de lancer la connexion Google.',
  login_error_credentials: 'Email ou mot de passe incorrect',
  login_email_label: 'Adresse Email',
  login_your_email: 'Votre email',
  register_title: 'Demarrez votre expansion',
  register_subtitle: 'Creez un compte et pilotez votre equipe de closers',
  register_google: 'S\'inscrire avec Google',
  register_or_continue: 'Ou continuer avec',
  register_name: 'Nom complet',
  register_submit: 'Creer mon compte Business',
  register_has_account: 'Vous avez deja un compte ?',
  register_login: 'Se connecter',
  register_terms_text: 'En creant un compte, vous acceptez nos',
  register_cgu: 'CGU',
  register_and: 'et notre',
  register_privacy_policy: 'Politique de Confidentialite',
  register_all_rights: 'Tous droits reserves.',
  register_error_sales_email: 'Cet email est deja associe a un compte CloseOS Sales. Veuillez utiliser un autre email.',
  register_error_generic: 'Une erreur est survenue.',
  register_error_google: 'Impossible de lancer la connexion Google.',
  verification_title: 'Verification de securite',
  verification_subtitle: 'Un code de verification a ete envoye a votre email',
  verification_verify: 'Verifier',
  verification_verifying: 'Verification...',
  verification_resend: 'Renvoyer le code',
  verification_resend_countdown: 'Renvoyer ({seconds}s)',
  verification_code_sent: 'Code envoye !',
  verification_cancel: 'Annuler',
  invitation_invalid_link: 'Lien d\'invitation invalide.',
  invitation_expired: 'Invitation invalide ou expiree.',
  invitation_validate_error: 'Impossible de valider l\'invitation.',
  invitation_join_team: 'Rejoindre l\'equipe',
  invitation_as_role: 'en tant que',
  invitation_first_name: 'Prenom',
  invitation_last_name: 'Nom',
  invitation_submit: 'Rejoindre',
  invitation_google: 'Continuer avec Google',
  invitation_or_continue: 'Ou',
  invitation_success_title: 'Bienvenue dans l\'equipe !',
  invitation_success_subtitle: 'Votre compte a ete cree avec succes.',
  invitation_go_dashboard: 'Aller au tableau de bord',
  invitation_accept_error: 'Erreur lors de l\'acceptation de l\'invitation.',
  invitation_email_sales_conflict: 'Cet email est deja associe a un compte CloseOS Sales. Veuillez utiliser un autre email.',
  invitation_account_sales_conflict: 'Ce compte est deja associe a un compte CloseOS Sales. Veuillez vous deconnecter et utiliser un autre email.',
  invitation_account_creation_error: 'Erreur lors de la creation du compte.',
  invitation_generic_error: 'Une erreur est survenue.',
  invitation_google_error: 'Impossible de lancer la connexion Google.',
  invitation_google_sales_conflict: 'Ce compte Google est deja associe a un compte CloseOS Sales. Veuillez utiliser un autre compte.',
  invitation_accept_error_short: 'Erreur lors de l\'acceptation.',
  invitation_invalid_title: 'Invitation invalide',
  invitation_create_business: 'Creer un compte Business',
  invitation_welcome_title: 'Bienvenue dans l\'equipe !',
  invitation_welcome_joined: 'Vous avez rejoint',
  invitation_welcome_as: 'en tant que',
  invitation_redirecting: 'Redirection vers le dashboard...',
  invitation_join_company: 'Rejoignez',
  invitation_leader: 'Dirigeant',
  invitation_website: 'Site web',
  invitation_address: 'Adresse',
  invitation_secure_access: 'Acces securise',
  invitation_invited_by: 'Invite par',
  invitation_or_email: 'Ou avec email',
  invitation_email_label: 'Adresse email',
  invitation_password_label: 'Mot de passe',
  invitation_accept_btn: 'Accepter l\'invitation',
  invitation_terms_prefix: 'En continuant, vous acceptez nos',
  invitation_terms_link: 'Conditions Generales',
  invitation_terms_and: 'et notre',
  invitation_privacy_link: 'Politique de Confidentialite',
  invitation_already_account: 'Deja un compte ?',
  invitation_login: 'Se connecter',
  invitation_default_manager: 'Un manager',
  invitation_default_company: 'une organisation',
  invitation_default_role: 'Membre',
  // ─── Closer Dashboard ───
  closer_dashboard_activity_status: 'Voici l\'etat de votre activite aujourd\'hui.',
  closer_dashboard_view_kpis: 'Voir mes KPIs',
  closer_dashboard_tooltip_commission: 'Commission totale calculee sur vos ventes signees. Inclut vos commissions closer et setter si applicable.',
  closer_dashboard_tooltip_ca: 'Chiffre d\'affaires total genere par vos prospects gagnes (stage Gagne). Somme de la valeur de chaque prospect signe.',
  closer_dashboard_commission: 'Commission',
  closer_dashboard_ca_generated: 'CA Genere',
  closer_dashboard_tooltip_closing: 'Taux de closing : pourcentage de prospects convertis en vente. Calcule : prospects gagnes / (gagnes + perdus + no-shows ayant eu un rendez-vous).',
  closer_dashboard_closing: 'Closing',
  closer_dashboard_signed_decided: 'signes / {decided} decides',
  closer_dashboard_tooltip_booking: 'Taux de booking : pourcentage de prospects contactes qui ont ete bookes (passes au-dela du stade prospect). Calcule : bookes / total prospects assignes en tant que setter.',
  closer_dashboard_booking: 'Booking',
  closer_dashboard_booked_prospects: 'bookes / {total} prospects',
  closer_dashboard_tooltip_appointments: 'Nombre total de rendez-vous planifies a venir (confirmes et en attente) a partir d\'aujourd\'hui.',
  closer_dashboard_appointments_label: 'Rendez-vous',
  closer_dashboard_upcoming: 'A venir',
  closer_dashboard_tooltip_noshow: 'Taux de no-show : pourcentage de prospects absents au rendez-vous. Calcule : no-shows / total des prospects qualifies ayant eu un rendez-vous (exclut prospect, non-qualifie, pas de reponse).',
  closer_dashboard_noshow: 'No-Show',
  closer_dashboard_upcoming_appointments: 'Prochains rendez-vous',
  closer_dashboard_upcoming_desc: 'Vos prochaines consultations planifiees.',
  closer_dashboard_view_all: 'Voir tout',
  closer_dashboard_no_appointments: 'Aucun rendez-vous a venir',
  closer_dashboard_appointment_fallback: 'Rendez-vous',
  closer_dashboard_reminders: 'Rappels',
  closer_dashboard_no_reminders: 'Aucun rappel en attente',
  closer_dashboard_overdue: 'EN RETARD',
  closer_dashboard_upcoming_tag: 'A VENIR',
  closer_dashboard_overdue_prefix: 'Retard : ',
  closer_dashboard_mark_done_title: 'Marquer comme fait',
  closer_dashboard_create_reminder: '+ Creer un rappel',
  closer_dashboard_member_fallback: 'Membre',
  dashboard_appt_today: 'AUJ.',
  dashboard_appt_tomorrow: 'DEM.',
  dashboard_reminder_done: 'Rappel marque comme fait !',
  return_payment_success: 'Paiement reussi !',
  return_create_account: 'Creez votre compte pour acceder a CloseOS Business.',
  return_name: 'Nom complet',
  return_submit: 'Creer mon compte',
  return_creating: 'Creation du compte...',
  return_processing: 'Traitement en cours...',

  // ─── Prospect View ───
  prospect_info: 'Informations',
  prospect_history: 'Historique',
  prospect_calls: 'Appels',
  prospect_appointments: 'Rendez-vous',
  prospect_notes: 'Notes',
  prospect_add_note: 'Ajouter une note',
  prospect_edit: 'Modifier',
  prospect_delete: 'Supprimer',
  prospect_source: 'Source',
  prospect_formula: 'Formule',
  prospect_assigned: 'Assigne a',
  prospect_created: 'Cree le',
  prospect_amount: 'Montant',
  prospect_contact: 'Contact',
  prospect_no_name: 'Sans nom',
  prospect_open_callroom: 'Ouvrir le Call Room',
  prospect_create_reminder: 'Creer un rappel',
  prospect_tab_info: 'Informations',
  prospect_tab_call_notes: 'Notes d\'Appel',
  prospect_tab_reminders: 'Rappels',
  prospect_tab_history: 'Historique',
  prospect_current_stage: 'Etape actuelle',
  prospect_loss_reason_title: 'Raison de la perte',
  prospect_loss_reason_label: 'Motif',
  prospect_loss_reason_select: 'Selectionnez un motif',
  prospect_loss_details: 'Details',
  prospect_loss_details_placeholder: 'Precisez les details...',
  prospect_payment_title: 'Details du Paiement',
  prospect_payment_final_amount: 'Montant final (EUR)',
  prospect_payment_sale_amount: 'Montant Vente',
  prospect_payment_cash: 'Comptant',
  prospect_payment_installments: 'Plusieurs fois',
  prospect_payment_nb_installments: 'Nombre de mensualites',
  prospect_payment_commission: 'Ta Commission ({rate}%)',
  prospect_payment_you_receive: 'Tu recevras : {amount} / mois',
  prospect_payment_validate: 'Valider les details',
  prospect_payment_total_commission: 'Commission Totale ({rate}%)',
  prospect_payment_client_pays: 'Client paie (x{count}) :',
  prospect_payment_you_get: 'Tu recois :',
  prospect_payment_times_per_month: '{n} fois ({amount}/mois)',
  prospect_payment_monthly: '/ mois',
  prospect_payment_label_cash: 'Paiement Comptant',
  prospect_payment_label_installments: 'Paiement en {count} fois',
  prospect_stripe_subscription: 'Abonnement Stripe',
  prospect_stripe_status: 'Statut',
  prospect_stripe_active: 'Actif',
  prospect_stripe_past_due: 'En retard',
  prospect_stripe_canceled: 'Annule',
  prospect_stripe_trialing: 'Essai',
  prospect_stripe_amount_label: 'Montant',
  prospect_stripe_month: 'mois',
  prospect_stripe_year: 'an',
  prospect_stripe_last_payment: 'Dernier paiement',
  prospect_stripe_next_payment: 'Prochain paiement',
  prospect_stripe_linked_webhook: 'Lie automatiquement (webhook)',
  prospect_stripe_linked_auto: 'Lie automatiquement',
  prospect_stripe_linked_manual: 'Lie manuellement',
  prospect_stripe_link_btn: 'Lier un abonnement Stripe',
  prospect_stripe_link_title: 'Lier a Stripe',
  prospect_stripe_auto_search: 'Recherche automatique via l\'email',
  prospect_stripe_not_found: 'Aucun abonnement trouve. Essayez Recherche ou Manuel.',
  prospect_stripe_search_btn: 'Rechercher',
  prospect_stripe_search_placeholder: 'Email du client Stripe',
  prospect_stripe_no_customer: 'Aucun client trouve.',
  prospect_stripe_no_sub: 'Aucun abonnement',
  prospect_stripe_link_manual_btn: 'Lier cet abonnement',
  prospect_stripe_linked_success: 'Abonnement Stripe lie avec succes',
  prospect_assign_closer: 'Assigner un Closer',
  prospect_assign_setter: 'Assigner un Setter',
  prospect_assign_none: 'Aucun',
  prospect_campaign_origin: 'Campagne d\'origine',
  prospect_offer_formula: 'Offre / Formule',
  prospect_no_offer: 'Aucune offre',
  prospect_capture_responses: 'Reponses de capture',
  prospect_qualification: 'Qualification',
  prospect_answers: 'Reponses',
  prospect_global_score: 'Score global',
  prospect_eliminatory: 'Eliminatoires : {count}/{max}',
  prospect_disqualified: 'Disqualifie',
  prospect_client_card: 'Fiche Client',
  prospect_phone: 'Telephone',
  prospect_creation_date: 'Date de creation',
  prospect_next_appointment: 'Prochain rendez-vous',
  prospect_internal_notes: 'Notes Internes',
  prospect_notes_placeholder: 'Ajouter un commentaire sur le profil du prospect...',
  prospect_save_btn: 'Enregistrer',
  prospect_cancel_btn: 'Annuler',
  prospect_no_notes: 'Aucune note',
  prospect_capture_data_ref: '(Donnees de capture - voir section ci-dessus)',
  prospect_add_manual_note: 'Ajouter une note manuelle',
  prospect_new_note: 'Nouvelle Note',
  prospect_note_placeholder: 'Ecrivez votre note d\'appel ici...',
  prospect_no_call_notes: 'Aucune note d\'appel',
  prospect_manual_notes_hint: 'Vos notes manuelles apparaitront ici.',
  prospect_add_reminder: 'Ajouter un rappel',
  prospect_no_reminders: 'Aucun rappel',
  prospect_create_reminder_hint: 'Creez un rappel pour ce prospect.',
  prospect_reminder_done: 'Fait',
  prospect_reminder_overdue: 'En retard',
  prospect_new_reminder: 'Nouveau rappel',
  prospect_reminder_title: 'Titre *',
  prospect_reminder_title_placeholder: 'Ex: Rappeler le prospect',
  prospect_reminder_description: 'Description',
  prospect_reminder_desc_placeholder: 'Details optionnels...',
  prospect_reminder_date: 'Date *',
  prospect_reminder_time: 'Heure *',
  prospect_reminder_linked: 'Lie a :',
  prospect_reminder_this_prospect: 'Ce prospect',
  prospect_reminder_create_btn: 'Creer le rappel',
  prospect_no_history: 'Aucun historique enregistre',
  prospect_history_changes_hint: 'Les modifications apparaitront ici.',
  prospect_history_by: 'Par :',
  prospect_history_created: 'Creation du prospect',
  prospect_history_stage_arrow: 'Etape -> {stage}',
  prospect_history_step_change: 'Changement d\'etape',
  prospect_history_stripe_renewal: 'Renouvellement Stripe',
  prospect_history_stripe_linked: 'Abonnement Stripe lie',
  prospect_history_field_modified: '{field} modifie',
  prospect_history_fields_modified: '{count} champs modifies',
  prospect_footer_delete: 'Supprimer',
  prospect_footer_add_pipeline: 'Rajouter au pipeline',
  prospect_footer_remove_pipeline: 'Retirer du pipeline',
  prospect_footer_save: 'Enregistrer',
  prospect_toast_photo_updated: 'Photo mise a jour',
  prospect_toast_upload_error: 'Erreur lors de l\'upload',
  prospect_toast_file_required: 'Fichier image requis',
  prospect_toast_file_too_large: 'Image trop lourde (max 5 Mo)',
  prospect_toast_stripe_auto: 'Abonnement Stripe lie automatiquement',
  prospect_toast_stripe_linked: 'Abonnement Stripe lie',
  prospect_toast_stripe_manual: 'Abonnement Stripe lie manuellement',
  prospect_toast_stripe_error: 'Impossible de lier l\'abonnement',
  prospect_toast_stripe_link_error: 'Erreur de liaison Stripe',
  prospect_toast_stripe_success: 'Abonnement Stripe lie avec succes',
  prospect_toast_reminder_created: 'Rappel cree',
  prospect_toast_reminder_error: 'Impossible de creer le rappel',
  prospect_toast_email_missing: 'Email manquant',
  prospect_toast_phone_missing: 'Telephone manquant',
  prospect_toast_added_pipeline: 'Prospect rajoute au pipeline',
  prospect_toast_removed_pipeline: 'Prospect retire du pipeline',
  prospect_toast_error: 'Erreur',
  prospect_confirm_delete_note: 'Supprimer cette note ?',
  prospect_confirm_delete: 'Supprimer {name} ?',
  prospect_no_tags: 'Aucun tag disponible',
  prospect_change_photo: 'Changer la photo',
  prospect_history_empty: '(vide)',
  prospect_history_yes: 'Oui',
  prospect_history_no: 'Non',
  prospect_history_cash: 'Comptant',
  prospect_history_installments_label: 'Mensualites',
  prospect_history_photo_updated: 'Photo mise a jour',
  prospect_history_none_formula: '(aucune)',
  prospect_field_firstname: 'Prenom',
  prospect_field_lastname: 'Nom',
  prospect_field_contact: 'Contact',
  prospect_field_email: 'Email',
  prospect_field_phone_label: 'Telephone',
  prospect_field_company: 'Entreprise',
  prospect_field_title: 'Poste',
  prospect_field_stage: 'Etape',
  prospect_field_value: 'Montant',
  prospect_field_offer: 'Offre',
  prospect_field_offer_id: 'Offre ID',
  prospect_field_formula_id: 'Formule',
  prospect_field_assigned_closer: 'Closer assigne',
  prospect_field_assigned_setter: 'Setter assigne',
  prospect_field_payment_type: 'Mode de paiement',
  prospect_field_installments: 'Mensualites',
  prospect_field_probability: 'Probabilite',
  prospect_field_notes_label: 'Notes',
  prospect_field_avatar: 'Photo de profil',
  prospect_field_pipeline_visible: 'Visible pipeline',
  prospect_field_loss_reason: 'Raison de perte',
  prospect_field_loss_details: 'Details de perte',
  prospect_field_stripe_sub: 'Abonnement Stripe',
  prospect_field_sub_status: 'Statut abonnement',
  prospect_system_author: 'Systeme',
  prospect_manual_author: 'Manuel',
  prospect_search_label: 'Recherche',
  prospect_manual_label: 'Manuel',
  prospect_eliminatory_label: 'Eliminatoire',
  prospect_sauvegarder: 'Sauvegarder',

  // ─── Invite Modal ───
  invite_title: 'Inviter un membre',
  invite_desc: 'Generez un lien d\'invitation pour ajouter un membre a votre equipe.',
  invite_role_label: 'Role du nouveau membre',
  invite_generate: 'Generer le lien',
  invite_link_ready: 'Lien pret !',
  invite_copy: 'Copier le lien',
  invite_expires: 'Expire dans 7 jours',
  invite_admin_full_access: 'Acces complet',
  invite_admin_same_rights: 'Un Admin a exactement les memes droits que le Owner sur toute la plateforme.',
  invite_hos_campaign_mgmt: 'Gestion des campagnes',
  invite_hos_campaign_desc: 'Lui donner acces a la page Campagnes',
  invite_setter_mode: 'Mode de setting',
  invite_setter_self: 'Set pour lui-meme',
  invite_setter_all: 'Set pour tout le monde',
  invite_setter_self_desc: 'Ne peut booker que pour lui-meme et ne peut pas assigner de prospects a d\'autres closers.',
  invite_setter_all_desc: 'Peut booker des RDV pour les autres membres et assigner des prospects aux closers.',
  invite_link_generated: 'Lien d\'invitation genere !',
  invite_send_by_email: 'Envoyer par email',
  invite_email_sent: 'Invitation envoyee a {email}',
  invite_email_placeholder: 'email@exemple.com',
  invite_email_error: 'Impossible d\'envoyer l\'email',
  invite_close: 'Fermer',
  invite_fallback_name: 'Votre manager',

  // ─── Paywall ───
  paywall_title: 'Fonctionnalite premium',
  paywall_desc: 'Cette fonctionnalite est reservee aux formules superieures.',
  paywall_upgrade: 'Passer a la formule superieure',
  paywall_feature_locked: 'Fonctionnalite verrouillee',
  paywall_trial_ended: 'Votre période d\'essai est terminée',
  paywall_trial_ended_desc: 'Votre essai gratuit a expiré. Choisissez une formule pour continuer à utiliser CloseOS Business.',
  paywall_choose_plan: 'Choisir une formule',
  paywall_contact_question: 'Une question ?',
  block_access_blocked: 'Acces bloque',
  block_renewal_failed: 'Le renouvellement de votre abonnement a echoue. Veuillez mettre a jour votre moyen de paiement pour continuer a utiliser CloseOS Business.',
  block_days_left_prefix: 'Suppression du compte dans',
  block_days_left_day: 'jour',
  block_days_left_suffix: 'si le paiement n\'est pas regularise.',
  block_deletion_in_progress: 'La suppression de votre compte est en cours.',
  block_update_payment: 'Mettre a jour le paiement',
  block_need_help: 'Besoin d\'aide ?',

  // ─── Checkout ───
  checkout_title: 'Finaliser votre inscription',
  checkout_plan: 'Formule',
  checkout_billing: 'Facturation',
  checkout_monthly: 'Mensuel',
  checkout_quarterly: 'Trimestriel',
  checkout_annual: 'Annuel',
  checkout_promo: 'Code promo',
  checkout_apply: 'Appliquer',
  checkout_total: 'Total',
  checkout_submit: 'S\'inscrire',
  checkout_creating_sub: 'Creation de l\'abonnement...',
  checkout_creating_account: 'Creation du compte...',
  checkout_name: 'Nom complet',
  checkout_email: 'Adresse email',
  checkout_phone: 'Numero de telephone',
  checkout_password: 'Mot de passe',
  checkout_confirm_password: 'Confirmer le mot de passe',
  checkout_passwords_mismatch: 'Les mots de passe ne correspondent pas.',
  checkout_password_strength: 'Niveau de securite',
  checkout_password_weak: 'Faible',
  checkout_password_medium: 'Moyen',
  checkout_password_strong: 'Fort',
  checkout_password_very_strong: 'Tres fort',
  checkout_trial_info: '20 jours d\'essai gratuit',
  checkout_back: 'Retour',
  checkout_your_plan: 'Votre formule',
  checkout_billing_annual_desc: 'Facturation annuelle',
  checkout_billing_quarterly_desc: 'Facturation trimestrielle',
  checkout_billing_monthly_desc: 'Facturation mensuelle',
  checkout_price_total_prefix: 'soit',
  checkout_trial_days_free: 'jours d\'essai gratuit',
  checkout_hide_features: 'Masquer les fonctionnalites',
  checkout_show_features: 'Voir les fonctionnalites incluses',
  checkout_promo_placeholder: 'Entrez votre code',
  checkout_promo_free_trial: 'Essai gratuit active !',
  checkout_promo_lifetime: 'Acces gratuit a vie active !',
  checkout_promo_extended: 'Essai etendu !',
  checkout_promo_discount: 'Reduction appliquee !',
  checkout_promo_applied: 'Code applique !',
  checkout_promo_invalid: 'Code invalide ou expire',
  checkout_extras_label: 'Services supplementaires (optionnel)',
  checkout_extras_total: '(paiement unique)',
  checkout_payment_section: 'Paiement',
  checkout_card_saved: 'Carte enregistree',
  checkout_create_account_section: 'Creer votre compte',
  checkout_error_sales_email: 'Cet email est deja associe a un compte CloseOS Sales. Utilisez un autre email.',
  checkout_error_server: 'Erreur serveur',
  checkout_error_payment_failed: 'Le paiement a echoue.',
  checkout_error_generic: 'Une erreur est survenue.',
  checkout_validation_fields: 'Veuillez remplir tous les champs (mot de passe : 8 caracteres minimum).',
  checkout_validation_payment: 'Veuillez remplir vos informations de paiement.',
  checkout_step_verification: 'Verification...',
  checkout_step_payment: 'Validation du paiement...',
  checkout_loading: 'Chargement...',
  checkout_launch: 'Lancer',
  checkout_terms_text: 'En vous inscrivant, vous acceptez nos',
  checkout_terms_cgu: 'CGU',
  checkout_terms_and: 'et notre',
  checkout_terms_privacy: 'Politique de Confidentialite',
  checkout_lifetime_free_title: 'Acces gratuit a vie',
  checkout_days_offered: 'jours offerts',
  checkout_create_start: 'Creez votre compte pour demarrer immediatement',
  checkout_preparing_payment: 'Preparation du paiement...',
  checkout_already_account: 'Deja un compte ?',
  checkout_login: 'Se connecter',
  checkout_extra_setup_name: 'Setup',
  checkout_extra_setup_desc: 'Configuration complete de l\'outil : campagnes, formules, pipeline, equipe, onboarding.',
  checkout_extra_integration_name: 'Integration',
  checkout_extra_integration_desc: 'Integration technique sur votre site : iframe, embed, pop-up.',
  checkout_extra_combo_name: 'Setup + Integration',
  checkout_extra_combo_desc: 'Les deux combines \u2014 economisez 20\u20ac.',

  // ─── Return (additional) ───
  return_payment_checking: 'Verification du paiement...',
  return_payment_confirmed: 'Paiement confirme !',
  return_finalize_account: 'Finalisez votre compte pour acceder a votre espace',
  return_email_label: 'Email (lie au paiement)',
  return_password_label: 'Choisir un mot de passe',
  return_password_placeholder: 'Minimum 8 caracteres',
  return_activate: 'Activer mon compte',
  return_error_sales_email: 'Cet email est deja associe a un compte CloseOS Sales. Veuillez utiliser un autre email.',
  return_error_generic: 'Une erreur est survenue lors de la creation du compte.',
  return_terms_text: 'En vous inscrivant, vous acceptez nos',
  return_terms_cgu: 'CGU',
  return_terms_and: 'et notre',
  return_terms_privacy: 'Politique de Confidentialite',
  return_copyright: 'Tous droits reserves.',

  // ─── Verification (additional) ───
  verification_required: 'V\u00e9rification requise',
  verification_code_sent_to: 'Un code a \u00e9t\u00e9 envoy\u00e9 \u00e0',
  verification_sending: 'Envoi du code en cours...',
  verification_error_send: 'Impossible d\'envoyer le code',
  verification_error_invalid: 'Code invalide ou expir\u00e9',
  verification_resend_in: 'Renvoyer dans',
  verification_back_login: 'Retour \u00e0 la connexion',

  // ─── Days ───
  day_mon: 'Lun',
  day_tue: 'Mar',
  day_wed: 'Mer',
  day_thu: 'Jeu',
  day_fri: 'Ven',
  day_sat: 'Sam',
  day_sun: 'Dim',

  // ─── Months ───
  month_jan: 'Janvier',
  month_feb: 'Fevrier',
  month_mar: 'Mars',
  month_apr: 'Avril',
  month_may: 'Mai',
  month_jun: 'Juin',
  month_jul: 'Juillet',
  month_aug: 'Aout',
  month_sep: 'Septembre',
  month_oct: 'Octobre',
  month_nov: 'Novembre',
  month_dec: 'Decembre',

  // ─── Calls (CloserAppels) ───
  calls_title: 'Appels',
  calls_subtitle: 'Gérez vos appels, scripts et suivez vos prospects.',
  calls_search_placeholder: 'Rechercher un prospect ou un appel...',
  calls_quick_call: 'Call Rapide',
  calls_new_call: 'Nouvel Appel',
  calls_recent: 'Appels Récents',
  calls_finished: 'Terminé',
  calls_no_calls: 'Aucun appel récent.',
  calls_no_calls_desc: 'Lancez un appel pour commencer.',
  calls_details: 'Détails',
  calls_delete_confirm: 'Supprimer cet appel ?',
  calls_deleted: 'Appel supprimé',
  calls_select_prospect: 'Sélectionner un prospect',
  calls_no_assigned_prospect: 'Aucun prospect assigné',
  calls_prepare_call: 'Préparer l\'appel',
  calls_prepare_title: 'Préparer l\'appel',
  calls_open_meet: 'Ouvrir Meet',
  calls_launch_cockpit: 'Lancer le Cockpit',
  calls_meet_link_placeholder: 'Lien Meet (optionnel)',
  calls_script_saved: 'Script sauvegardé',
  calls_delete_script_confirm: 'Supprimer ce script ?',
  calls_new_script: '+ Nouveau Script',
  calls_script_title_placeholder: 'Titre du script',
  calls_script_write_placeholder: 'Rédigez votre script ici...',
  calls_saving: 'Sauvegarde...',
  calls_no_slots_to_copy: 'Aucun créneau à copier',
  calls_ago_min: 'il y a {n} min',
  calls_ago_hours: 'il y a {n}h',
  calls_yesterday: 'Hier',
  calls_ago_days: 'il y a {n}j',
  calls_my_script: 'Mon Script',
  closer_appels_in_progress: 'En cours...',
  closer_appels_video_call: 'Appel vidéo',
  closer_appels_step1_open_meet: 'Étape 1 : Ouvrez Google Meet',
  closer_appels_step2_launch_cockpit: 'Étape 2 : Lancez le cockpit',

  // ─── Invoices (CloserFactures) ───
  invoices_fixed_salary_title: 'Factures & Salaire Fixe',
  invoices_fixed_plus_commission_title: 'Factures & Rémunération',
  invoices_commission_title: 'Factures & Commissions',
  invoices_fixed_salary_subtitle: 'Suivez votre salaire fixe et gérez vos factures',
  invoices_fixed_plus_commission_subtitle: 'Suivez votre fixe, vos commissions et gérez vos factures',
  invoices_commission_subtitle: 'Suivez vos commissions et gérez vos factures',
  invoices_connect_stripe: 'Connecter Stripe',
  invoices_issuer_info: 'Infos Émetteur',
  invoices_payment_methods: 'Moyens de Paiement',
  invoices_generate_invoice: 'Générer une facture',
  invoices_period: 'Période',
  invoices_monthly: 'Mensuel',
  invoices_fixed_salary: 'Salaire Fixe',
  invoices_my_commission: 'Ma Commission',
  invoices_commission_closer: 'Commission Closer',
  invoices_commission_setter: 'Commission Setter',
  invoices_revenue_generated: 'CA Généré',
  invoices_paid: 'Payé',
  invoices_pending: 'En attente',
  invoices_period_details: 'Détails de la période',
  invoices_cash_payment: 'Paiement Comptant',
  invoices_installment_payment: 'Paiement en plusieurs fois',
  invoices_total: 'Total',
  invoices_invoice_number: 'N° Facture',
  invoices_date_col: 'Date',
  invoices_client_offer: 'Client & Offre',
  invoices_amount_ttc: 'Montant TTC',
  invoices_due_date: 'Échéance',
  invoices_status_col: 'Statut',
  invoices_actions_col: 'Actions',
  invoices_overdue: 'Retard',
  invoices_link: 'Lien',
  invoices_pay: 'Payer',
  invoices_view: 'Voir',
  invoices_no_invoices_period: 'Aucune facture sur cette période',
  invoices_status_to_pay: 'À payer',
  invoices_status_in_progress: 'En cours',
  invoices_status_paid_label: 'Payé',
  invoices_status_sent: 'Envoyée',
  invoices_status_generated: 'Générée',
  invoices_status_late: 'En retard',
  invoices_status_waiting: 'En attente',
  invoices_status_draft: 'Brouillon',
  invoices_status_updated: 'Statut mis à jour',
  invoices_link_copied: 'Lien copié',
  invoices_ca_label: 'CA',
  invoices_deal_label: 'deal',

  // ─── Invoices Owner ───
  invoices_owner_title: 'Factures',
  invoices_owner_subtitle: 'Toutes les factures de votre organisation',
  invoices_total_billed: 'Total facturé',
  invoices_total_billed_global: 'Total facturé (global)',
  invoices_paid_label: 'Payé',
  invoices_pending_label: 'En attente',
  invoices_pending_count: 'factures',
  invoices_filter_period: 'Période',
  invoices_filter_member: 'Membre',
  invoices_filter_all_members: 'Tous les membres',
  invoices_filter_status: 'Statut',
  invoices_filter_all_statuses: 'Tous les statuts',
  invoices_th_invoice_number: 'N° Facture',
  invoices_th_date: 'Date',
  invoices_th_client: 'Client',
  invoices_th_member: 'Membre',
  invoices_th_amount: 'Montant',
  invoices_th_due_date: 'Échéance',
  invoices_th_status: 'Statut',
  invoices_th_actions: 'Actions',
  invoices_copy_payment_link: 'Copier le lien de paiement',
  invoices_details_button: 'Détails',
  invoices_download_button: 'Télécharger',
  invoices_view_button: 'Voir',
  invoices_empty_title: 'Aucune facture',
  invoices_empty_desc: 'Aucune facture sur cette période',
  invoices_pagination_of: 'sur',
  invoices_error_toast: 'Erreur lors du chargement des factures',

  // ─── Formulas (CloserFormules) ───
  formulas_management: 'Gestion Commerciale',
  formulas_count: '{n} formule{s}',
  formulas_readonly: 'Formules tarifaires de l\'organisation (lecture seule)',
  formulas_no_formulas_title: 'Aucune formule',
  formulas_no_formulas_desc: 'Votre manager n\'a pas encore créé de formules.',
  formulas_active: 'Active',
  formulas_inactive: 'Inactive',
  formulas_on_quote: 'Sur devis',
  formulas_per_month: 'mois',
  formulas_one_time: 'unique',
  formulas_per_year: 'an',
  formulas_resources_count: '{n} Ressource{s}',
  formulas_open: 'Ouvrir',
  formulas_no_resources: 'Aucune ressource',
  formulas_detail_title: 'Détails de la formule',
  formulas_label_name: 'Nom',
  formulas_label_price: 'Prix',
  formulas_label_description: 'Description',
  formulas_new_formula: 'Nouvelle Formule',
  formulas_create_formula: 'Créer une formule',
  formulas_create_first_desc: 'Créez votre première formule tarifaire',
  formulas_edit_formula: 'Modifier la formule',
  formulas_name_required: 'Le nom est requis',
  formulas_modified: 'Formule modifiée',
  formulas_created: 'Formule créée',
  formulas_network_error: 'Erreur réseau',
  formulas_deactivated: 'Formule désactivée',
  formulas_activated: 'Formule activée',
  formulas_delete_confirm: 'Supprimer la formule',
  formulas_deleted: 'Formule supprimée',
  formulas_select_pdf: 'Veuillez sélectionner un fichier PDF',
  formulas_upload_error: 'Erreur lors du téléversement',
  formulas_pdf_uploaded: 'PDF téléversé',
  formulas_formula_name_label: 'Nom de la formule *',
  formulas_formula_name_placeholder: 'Ex: Formule Premium',
  formulas_price_label: 'Prix (€)',
  formulas_billing_type_label: 'Type de facturation',
  formulas_billing_one_time: 'Paiement unique',
  formulas_billing_subscription: 'Abonnement',
  formulas_billing_quote: 'Sur devis',
  formulas_subscription_pricing: 'Tarification abonnement',
  formulas_monthly_price_label: 'Prix mensuel (€) *',
  formulas_quarterly_price_label: 'Prix trimestriel (€)',
  formulas_quarterly_hint: 'Laissez vide si pas d\'option trimestrielle',
  formulas_per_quarter: 'trimestre',
  formulas_yearly_price_label: 'Prix annuel (€)',
  formulas_yearly_hint: 'Laissez vide si pas d\'option annuelle',
  formulas_stripe_connected: 'Stripe connecté',
  formulas_stripe_not_connected: 'Stripe non connecté',
  formulas_stripe_connected_desc: 'Les paiements récurrents seront automatiquement liés aux prospects gagnés avec cette formule.',
  formulas_stripe_not_connected_desc: 'Connectez Stripe dans Chiffre d\'affaires pour lier automatiquement les paiements récurrents.',
  formulas_description_label: 'Description',
  formulas_description_placeholder: 'Décrivez cette formule...',
  formulas_team_assigned: 'Équipe assignée',
  formulas_all_team: 'Toute l\'équipe',
  formulas_team_hint: 'Les commissions avancées ne montreront que les membres de cette équipe.',
  formulas_resources_included: 'Ressources incluses',
  formulas_add_resource: 'Ajouter',
  formulas_no_resources_hint: 'Aucune ressource. Ajoutez des fichiers PDF, liens vidéo, accès contenus...',
  formulas_no_resources_member: 'Aucune ressource',
  formulas_pdf_uploaded_link: 'PDF téléversé',
  formulas_change: 'Changer',
  formulas_uploading: 'Téléversement...',
  formulas_upload_pdf: 'Téléverser un PDF',
  formulas_commission_label: 'Commission',
  formulas_closing_label: 'Closing',
  formulas_setting_label: 'Setting',
  formulas_advanced: 'Avancé',
  formulas_customized: 'Personnalisé',
  formulas_reset_role_rate: 'Réinitialiser au taux du rôle',
  formulas_close_btn: 'Fermer',
  formulas_cancel_btn: 'Annuler',
  formulas_save_btn: 'Enregistrer',
  formulas_create_btn: 'Créer',
  formulas_error: 'Erreur',

  // ─── Appointments (CloserRendezVous) ───
  appointments_my_title: 'Mes Rendez-vous',
  appointments_assigned_count: '{n} rendez-vous assignés',
  appointments_all_statuses: 'Tous les statuts',
  appointments_date_from: 'Du',
  appointments_date_to: 'Au',
  appointments_reset_filters: 'Réinitialiser',
  appointments_no_appointments_title: 'Aucun rendez-vous',
  appointments_no_assigned: 'Aucun rendez-vous ne vous est assigné',
  appointments_no_matching_filters: 'Aucun rendez-vous ne correspond à vos filtres',
  appointments_date_time: 'Date & Heure',
  appointments_contact: 'Contact',
  appointments_email: 'Email',
  appointments_campaign: 'Campagne',
  appointments_duration: 'Durée',
  appointments_status: 'Statut',
  appointments_reassign: 'Réassigner',
  appointments_mark_done: 'Terminé',
  appointments_reassign_title: 'Réassigner le rendez-vous',
  appointments_reassign_desc: 'Sélectionnez un membre de l\'équipe à qui assigner ce rendez-vous.',
  appointments_no_member_available: 'Aucun autre membre disponible',
  appointments_confirm_reassign: 'Confirmer la réassignation',
  appointments_reassigned: 'Rendez-vous réassigné',
  appointments_reassign_error: 'Erreur lors de la réassignation',
  appointments_status_updated: 'Statut mis à jour',
  appointments_time_past: 'Passé',
  appointments_time_soon: 'Bientôt',
  appointments_time_ongoing: 'En cours',
  appointments_time_future: 'Futur',
  appointments_at_time: 'à',
  appointments_at_member: 'chez',

  // ─── BusinessAppointments (Owner page) ───
  appointments_timing_1d: '1 jour avant',
  appointments_timing_10h: '10h le jour même',
  appointments_timing_5h: '5h avant',
  appointments_timing_3h: '3h avant',
  appointments_timing_1h: '1h avant',
  appointments_timing_30m: '30 min avant',
  appointments_timing_15m: '15 min avant',
  appointments_timing_now: 'Immédiatement',
  appointments_var_lead_name: 'Nom du prospect',
  appointments_var_assignee_name: 'Nom de l\'assigné',
  appointments_var_title: 'Titre du RDV',
  appointments_var_date: 'Date du RDV',
  appointments_var_time: 'Heure du RDV',
  appointments_var_meet_link: 'Lien Google Meet',
  appointments_var_reschedule_link: 'Lien de report',
  appointments_var_cancel_link: 'Lien d\'annulation',
  appointments_new_reminder: 'Nouveau rappel',
  appointments_reminder_subject: 'Rappel de votre rendez-vous',
  appointments_manual_reminder: 'Rappel manuel',
  appointments_reminder_updated: 'Rappel mis à jour',
  appointments_reminder_created: 'Rappel créé',
  appointments_save_error: 'Erreur lors de la sauvegarde',
  appointments_reminder_deleted: 'Rappel supprimé',
  appointments_reminder_enabled: 'Rappel activé',
  appointments_reminder_disabled: 'Rappel désactivé',
  appointments_send_reminder_error: 'Erreur lors de l\'envoi du rappel',
  appointments_reminder_sent_to: 'Rappel envoyé à',
  appointments_send_error: 'Erreur d\'envoi',
  appointments_create_error: 'Erreur lors de la création',
  appointments_booking_link_created: 'Lien de booking créé',
  appointments_link_deleted: 'Lien supprimé',
  appointments_update_error: 'Erreur lors de la mise à jour',
  appointments_link_updated: 'Lien mis à jour',
  appointments_link_copied: 'Lien copié',
  appointments_deleted: 'Rendez-vous supprimé',
  appointments_delete_error: 'Erreur lors de la suppression',
  appointments_date_time_required: 'La date et l\'heure sont requises',
  appointments_created_with_meet: 'Rendez-vous créé avec Google Meet',
  appointments_created: 'Rendez-vous créé',
  appointments_configure_reminders: 'Configurer les rappels',
  appointments_manage_personal: 'Gérer mes rendez-vous',
  appointments_all_team: 'Toute l\'équipe',
  appointments_manage_calendar: 'Gérer le calendrier',
  appointments_tab_personal: 'Personnel',
  appointments_tab_member: 'Par membre',
  appointments_all_members: 'Tous les membres',
  appointments_status_all: 'Tous les statuts',
  appointments_book_rdv: 'Booker un RDV',
  appointments_new_rdv: 'Nouveau rendez-vous',
  appointments_schedule_new: 'Planifiez un nouveau rendez-vous pour votre équipe.',
  appointments_event_title: 'Titre de l\'événement',
  appointments_label_date: 'Date',
  appointments_label_time: 'Heure',
  appointments_assign_to: 'Assigner à',
  appointments_for_me: 'Pour moi',
  appointments_internal_notes: 'Notes internes',
  appointments_enable_google_meet: 'Activer Google Meet',
  appointments_connect_google_calendar: 'Connecter Google Calendar',
  appointments_confirm_rdv: 'Confirmer le RDV',
  appointments_edit_reminder: 'Modifier le rappel',
  appointments_email_reminders: 'Rappels par email',
  appointments_configure_reminder_desc: 'Configurez les détails de ce rappel.',
  appointments_auto_reminders_desc: 'Envoyez automatiquement des rappels aux prospects avant leurs rendez-vous.',
  appointments_manual_reminder_label: 'Rappel manuel',
  appointments_custom: 'Personnalisé',
  appointments_standard: 'Standard',
  appointments_sent_manually_desc: 'Envoyé manuellement depuis la fiche du rendez-vous.',
  appointments_configure_manual_reminder: 'Configurer le rappel manuel',
  appointments_auto_reminders: 'Rappels automatiques',
  appointments_no_auto_reminders: 'Aucun rappel automatique configuré',
  appointments_add_auto_reminder: 'Ajouter un rappel automatique',
  appointments_reminder_name: 'Nom du rappel',
  appointments_when_to_send: 'Quand envoyer',
  appointments_manual_reminder_desc: 'Ce rappel sera envoyé manuellement.',
  appointments_template_type: 'Type de template',
  appointments_sender_name: 'Nom de l\'expéditeur',
  appointments_email_always_from: 'Les emails sont toujours envoyés depuis support@closeos.fr',
  appointments_email_subject: 'Objet de l\'email',
  appointments_available_variables: 'Variables disponibles',
  appointments_html_content: 'Contenu HTML',
  appointments_preview: 'Aperçu',
  appointments_update: 'Mettre à jour',
  appointments_create_reminder: 'Créer le rappel',
  appointments_will_appear_here: 'Vos rendez-vous apparaîtront ici',

  // ─── Availability (CloserDisponibilite) ───
  availability_subtitle: 'Gérez vos créneaux et absences pour optimiser votre tunnel de vente.',
  availability_weekly_slots: 'Créneaux hebdomadaires',
  availability_unavailable: 'Indisponible',
  availability_add_slot_btn: 'Ajouter un créneau',
  availability_add_short: 'Ajouter',
  availability_cancel: 'Annuler',
  availability_copy_to: 'Copier vers {n} jour{s}',
  availability_weekend: 'Weekend',
  availability_absences_title: 'Absences',
  availability_no_absences: 'Aucune absence programmée',
  availability_start_date: 'Date début',
  availability_end_date: 'Date fin',
  availability_reason_optional: 'Motif (optionnel)',
  availability_reason_placeholder: 'Ex: Vacances, Formation...',
  availability_confirm: 'Confirmer',
  availability_new_absence: 'Nouvelle absence',
  availability_booking_settings: 'Paramètres de booking',
  availability_booking_rules_desc: 'Ces règles s\'appliquent à vos liens de réservation',
  availability_max_per_day: 'Max de RDV par jour',
  availability_unlimited: 'Illimité',
  availability_per_day: '{n} RDV / jour',
  availability_buffer_before: 'Temps libre avant un RDV',
  availability_buffer_desc: 'Empêche les bookings trop proches d\'un autre RDV',
  availability_no_buffer: 'Pas de buffer',
  availability_minutes: '{n} minutes',
  availability_hour: '{n} heure',
  availability_min_notice: 'Délai minimum avant un booking',
  availability_min_notice_desc: 'Impossible de réserver un créneau avant ce délai',
  availability_no_delay: 'Pas de délai',
  availability_hours_before: '{n} heure{s} avant',
  availability_save_settings: 'Enregistrer',
  availability_settings_saved: 'Paramètres enregistrés',
  availability_slot_added: 'Créneau ajouté',
  availability_slot_deleted: 'Créneau supprimé',
  availability_absence_added: 'Absence ajoutée',
  availability_slots_copied: 'Créneaux copiés vers {names}',
  availability_onboarding_title: 'Configurez vos disponibilités',
  availability_onboarding_desc: 'Avant de commencer, indiquez vos créneaux de disponibilité hebdomadaires. Cela permettra à votre manager de vous assigner des rendez-vous aux bons moments.',
  availability_onboarding_step1: '1. Ajoutez vos créneaux pour chaque jour',
  availability_onboarding_step2: '2. Indiquez vos périodes d\'absence si nécessaire',
  availability_onboarding_step3: '3. Modifiez ces informations à tout moment',
  availability_onboarding_go: 'C\'est parti !',
  availability_to_time: 'à',

  // ─── CallRoom (CloserCallRoom) ───
  callroom_desktop_only: 'Disponible sur ordinateur uniquement',
  callroom_desktop_only_desc: 'La Call Room nécessite un écran large pour fonctionner correctement.',
  callroom_back_dashboard: 'Retour au dashboard',
  callroom_header: 'Closer Call Room',
  callroom_prospect_sheet: 'Fiche Prospect',
  callroom_record: 'Enregistrer',
  callroom_end: 'Fin d\'appel',
  callroom_formulas_tab: 'Formules',
  callroom_resources_tab: 'Ressources',
  callroom_subscription: 'Abonnement',
  callroom_quote: 'Sur devis',
  callroom_monthly_label: 'Mensuel',
  callroom_yearly_label: 'Annuel',
  callroom_per_month: '/ mois',
  callroom_per_year: '/ an',
  callroom_quote_desc: 'Prix défini selon le projet — contactez pour un devis personnalisé.',
  callroom_no_formulas: 'Aucune formule configurée',
  callroom_select_formula: 'Sélectionnez une formule',
  callroom_no_resources_formula: 'Aucune ressource pour cette formule.',
  callroom_select_formula_resources: 'Sélectionnez une formule pour voir ses ressources.',
  callroom_no_script: 'Aucun script trouvé.',
  callroom_no_title: 'Sans titre',
  callroom_notepad: 'Prise de notes',
  callroom_auto_save: 'Sauvegarde auto',
  callroom_current_notes: 'Notes actuelles',
  callroom_no_note: 'Aucune note',
  callroom_notes_placeholder: 'Prise de notes...',
  callroom_send_pdf: 'Envoyer le PDF',
  callroom_email_address: 'Adresse email',
  callroom_email_placeholder: 'email@exemple.com',
  callroom_email_sent: 'Email envoyé avec succès',
  callroom_send: 'Envoyer',
  callroom_download_pdf: 'Télécharger le PDF',
  callroom_recording_failed: 'Impossible de lancer l\'enregistrement.',
  callroom_loading: 'Chargement...',

  // ─── Misc ───
  empty_state_title: 'Rien ici pour l\'instant',
  empty_state_desc: 'Les donnees apparaitront ici une fois que vous commencerez a utiliser CloseOS.',
  error_generic: 'Une erreur est survenue',
  error_network: 'Erreur de connexion',
  error_unauthorized: 'Acces non autorise',
  coming_soon: 'Bientot disponible',
  beta_badge: 'Beta',

  // ─── CRM Stages ───
  stage_prospect: 'Prospect',
  stage_qualified: 'Qualifie',
  stage_unqualified: 'Non-Qualifie',
  stage_won: 'Gagne',
  stage_lost: 'Perdu',
  stage_noanswer: 'Pas de Reponse',
  stage_noshow: 'No Show',
  stage_followup: 'Suivi',

  // ─── Extra common strings ───
  common_phone_label: 'Telephone',
  common_stage: 'Etape',
  common_period: 'Periode',
  common_assigned_to: 'Assigne a',
  common_assign_to: 'Assigner a',
  common_duration: 'Duree',
  common_details: 'Details',
  common_team: 'Equipe',
  common_create: 'Creer',
  common_creating: 'Creation...',
  common_select: 'Selectionner',
  common_no_data_available: 'Aucune donnee',
  common_first_name: 'Prenom',
  common_last_name: 'Nom',
  common_done: 'Termine',
  common_confirmed: 'Confirme',
  common_cancelled: 'Annule',
  common_paid: 'Paye',
  common_to_pay: 'A payer',
  common_link_copied: 'Lien copie',
  common_config_saved: 'Configuration sauvegardee',
  common_network_error: 'Erreur reseau',
  common_creation_error: 'Erreur lors de la creation',
  common_status_updated: 'Statut mis a jour',
  common_video: 'Video',
  common_custom: 'Personnalise',
  common_system: 'Systeme',
  common_all_teams: 'Toutes les equipes',
  common_whole_team: 'Toute l\'equipe',
  common_all_day: 'Toute la journee',
  common_all_periods: 'Toutes periodes',
  common_revenue_generated: 'CA Genere',
  common_no_appointments: 'Aucun rendez-vous a venir',
  common_deadline: 'Echeance',
  common_past: 'Passe',
  common_reminder_created: 'Rappel cree',
  common_create_reminder: 'Creer le rappel',
  common_select_stage: 'Selectionner une etape',
  common_select_reason: 'Selectionnez un motif',
  common_visio: 'Visioconference',
  common_integration_instructions: 'Instructions d\'integration',
  common_generate_api_key: 'Generer une cle API',
  common_reset_all: 'Reinitialiser tout',
  common_at: 'a',

  // ─── Loss reasons ───
  loss_thinking: 'Je dois y reflechir',
  loss_budget: 'Argent/budget',
  loss_need_talk: 'Doit en parler',
  loss_not_now: 'C\'est pas le moment',
  loss_fear: 'Peur',
  loss_smokescreen: 'Ecran de fumee',
  loss_other: 'Autre',

  // ─── Closer-specific ───
  closer_step1_assign: 'Etape 1 — Assigner un Closer',
  closer_step2_schedule: 'Etape 2 — Programmer le RDV',
  closer_auto_assigned: 'Closer assigne automatiquement',
  closer_random: 'Hasard (aleatoire)',

  // ─── Pipeline-specific ───
  pipeline_custom_statuses: 'Statuts Personnalises',
  pipeline_created_by_team: 'Crees par votre equipe',
  pipeline_auto_reset: 'Reinitialisation automatique',
  pipeline_auto_reset_desc: 'Vider le pipeline periodiquement',
  pipeline_enable_reset: 'Activer la reinitialisation',
  pipeline_reset_keeps_crm: 'Les prospects seront retires du pipeline mais resteront dans le CRM',
  pipeline_frequency: 'Frequence',
  pipeline_columns_to_clear: 'Colonnes a vider',
  pipeline_columns_desc: 'Selectionnez les statuts dont les prospects seront retires du pipeline',
  pipeline_by_default: 'par defaut',
  pipeline_last_reset: 'Derniere reinitialisation',
  pipeline_priority_ops: 'Operations Prioritaires',
  pipeline_elements: 'elements',
  pipeline_no_prospects: 'Aucun prospect trouve',
  pipeline_create_status: 'Creer le statut',
  pipeline_search: 'Rechercher...',
  pipeline_filters: 'Filtres',
  pipeline_reset_all: 'Réinitialiser tout',
  pipeline_new_status: 'Nouveau statut',
  pipeline_config_title: 'Configuration du pipeline',
  pipeline_config_pipeline: 'Configuration du pipeline',
  pipeline_period: 'Période',
  pipeline_period_all: 'Tout',
  pipeline_period_7days: '7 jours',
  pipeline_period_30days: '30 jours',
  pipeline_period_90days: '90 jours',
  pipeline_team: 'Équipe',
  pipeline_closer_setter: 'Closer / Setter',
  pipeline_no_members: 'Aucun membre',
  pipeline_stage: 'Statut',
  pipeline_offer_formula: 'Offre / Formule',
  pipeline_no_formulas: 'Aucune formule',
  pipeline_tags: 'Tags',
  pipeline_no_tags: 'Aucun tag',
  pipeline_prospect_no_name: 'Prospect sans nom',
  pipeline_prospect_count: 'prospect',
  pipeline_prospect_count_plural: 'prospects',
  pipeline_no_prospect_found: 'Aucun prospect trouvé',
  pipeline_active_flow: 'Flux Actif',
  pipeline_inactive_flow: 'Flux Inactif',
  pipeline_archives: 'Archives & Rejets',
  pipeline_custom_stages: 'Statuts Personnalisés',
  pipeline_no_prospect: 'Aucun prospect',
  pipeline_contact_header: 'Contact',
  pipeline_company_header: 'Entreprise',
  pipeline_stage_header: 'Étape',
  pipeline_tags_header: 'Tags',
  pipeline_assigned_header: 'Assigné à',
  pipeline_value_header: 'Valeur',
  pipeline_date_header: 'Date',
  pipeline_actions_header: 'Actions',
  pipeline_enable_reset_desc: 'Les prospects seront retirés du pipeline mais resteront dans le CRM',
  pipeline_weekly: 'Toutes les semaines',
  pipeline_biweekly: 'Toutes les 2 semaines',
  pipeline_monthly: 'Tous les mois',
  pipeline_default_label: 'par défaut',
  pipeline_saving: 'Enregistrement...',
  pipeline_config_saved: 'Configuration sauvegardée',
  pipeline_save_error: 'Erreur lors de la sauvegarde',
  pipeline_new_stage_title: 'Nouveau statut',
  pipeline_crm_warning: 'Votre CRM intégré ne prendra pas en compte les statuts personnalisés. Seuls Zapier et Make sont compatibles.',
  pipeline_crm_warning_text: 'Votre CRM intégré ({provider}) ne prendra pas en compte les statuts personnalisés. Seuls Zapier et Make sont compatibles.',
  pipeline_stage_title_label: 'Titre',
  pipeline_stage_title_placeholder: 'Ex: Négociation',
  pipeline_stage_desc: 'Description',
  pipeline_stage_desc_placeholder: 'Optionnel',
  pipeline_stage_color: 'Couleur',
  pipeline_stage_roles: 'Rôles concernés',
  pipeline_stage_creating: 'Création...',
  pipeline_stage_create: 'Créer le statut',
  pipeline_stage_created: 'Statut créé avec succès',
  pipeline_stage_create_error: 'Erreur lors de la création',
  pipeline_delete_stage_confirm: 'Supprimer le statut "{name}" ?',
  pipeline_at: 'à',
  pipeline_stage_prospect: 'Prospect',
  pipeline_stage_qualified: 'Qualifié',
  pipeline_stage_unqualified: 'Non-Qualifié',
  pipeline_stage_won: 'Gagné',
  pipeline_stage_followup: 'Follow Up',
  pipeline_stage_noanswer: 'Pas de Réponse',
  pipeline_stage_noshow: 'No Show',
  pipeline_stage_lost: 'Perdu',

  // ─── Organization-specific ───
  org_desc_page: 'Informations et parcours d\'integration de votre organisation.',
  org_no_info: 'Aucune information renseignee par l\'organisation.',
  org_general_onboarding: 'Onboarding general',
  org_onboarding_path: 'Parcours d\'integration de votre organisation',
  org_role_onboarding_path: 'Parcours specifique a votre role',
  org_onboarding_validated: 'Vous avez valide l\'onboarding.',
  org_logo_updated: 'Logo mis a jour !',
  org_updated: 'Organisation mise a jour avec succes !',
  org_owner: 'Proprietaire',
  org_customize_brand: 'Personnalisez votre identite de marque et definissez les parcours d\'integration de votre equipe.',
  org_vat_number: 'Numero de TVA',
  org_general_onboarding_desc: 'Cet onboarding sera presente a tous les nouveaux collaborateurs lors de leur integration.',
  org_role_onboarding_desc: 'Cet onboarding sera presente uniquement aux membres avec le role',
  org_first_step: 'Creez votre premiere etape d\'integration',
  org_role_step: 'Creez un parcours specifique pour les',
  org_custom_tab: 'Onglet personnalise — double-cliquez sur le nom pour le renommer',
  org_add_sections: 'Ajoutez des sections avec du texte, des videos ou des liens',
  org_write_here: 'Ecrivez votre texte ici...',
  org_video_url: 'URL de la video (YouTube, Loom...)',
  org_connected: 'Connecte',
  org_integration: 'Integration',
  org_subtitle: 'Informations et parcours d\'integration de votre organisation.',
  org_subtitle_owner: 'Personnalisez votre identite de marque et definissez les parcours d\'integration de votre equipe.',
  org_tab_organisation: 'ORGANISATION',
  org_tab_onboarding: 'ONBOARDING',
  org_tab_add: 'ONGLET',
  org_save_button: 'ENREGISTRER',
  org_brand_identity: 'Brand Identity',
  org_company_logo: 'Logo de l\'entreprise',
  org_company_logo_hint: 'SVG, PNG, ou JPG. Max 5Mo.',
  org_company_name_label: 'Nom de l\'entreprise',
  org_company_name_placeholder: 'Votre entreprise',
  org_description_label: 'Description',
  org_description_placeholder: 'Ce que fait votre entreprise...',
  org_website_label: 'Site web',
  org_contact_email_label: 'Email de contact',
  org_phone_label: 'Telephone',
  org_address_label: 'Adresse',
  org_billing_title: 'Facturation',
  org_billing_subtitle: 'Informations pour vos factures et documents officiels',
  org_raison_sociale_label: 'Raison sociale',
  org_raison_sociale_placeholder: 'Raison sociale de votre entreprise',
  org_siret_label: 'SIRET',
  org_tva_label: 'Numero de TVA',
  org_billing_address_label: 'Adresse de facturation',
  org_billing_zip_label: 'Code postal',
  org_billing_city_label: 'Ville',
  org_billing_country_label: 'Pays',
  org_info_title: 'Informations',
  org_email_label: 'Email',
  org_phone_info_label: 'Telephone',
  org_address_info_label: 'Adresse',
  org_persons: 'pers.',
  org_cancel_crop: 'Annuler',
  org_validate_logo: 'Valider le logo',
  org_logo_upload_error: 'Erreur lors de l\'upload du logo.',
  org_save_success: 'Organisation mise a jour avec succes !',
  org_save_error: 'Erreur lors de la sauvegarde.',
  org_new_tab: 'Nouvel onglet',
  org_untitled: 'Sans titre',
  org_custom_tab_subtitle: 'Onglet personnalise — double-cliquez sur le nom pour le renommer',
  org_section_name_placeholder: 'Nom de la nouvelle section...',
  org_add_section: 'Ajouter',
  org_text_block: 'Texte',
  org_video_block: 'Video',
  org_link_block: 'Lien',
  org_pdf_block: 'PDF',
  org_text_placeholder: 'Ecrivez votre texte ici...',
  org_video_placeholder: 'URL de la video (YouTube, Loom...)',
  org_link_title_placeholder: 'Titre du lien',
  org_upload_in_progress: 'Upload en cours...',
  org_choose_pdf: 'Choisir un fichier PDF',
  org_view_pdf: 'Voir le PDF',
  org_no_content: 'Aucun contenu disponible.',
  org_section_empty: 'Section vide',
  org_empty_sections_label: 'Aucune section',
  org_empty_sections_desc: 'Ajoutez des sections avec du texte, des videos ou des liens',
  org_onboarding_guide: 'Guide d\'onboarding',
  org_onboarding_guide_desc: 'Lecture obligatoire avant de commencer. Cliquez pour ouvrir le guide complet.',
  org_onboarding_general: 'Onboarding general',
  org_onboarding_general_desc: 'Parcours d\'integration de votre organisation',
  org_onboarding_role: 'Onboarding',
  org_onboarding_role_desc: 'Parcours specifique a votre role',
  org_onboarding_ack_button: 'J\'AI BIEN PRIS CONNAISSANCE DE L\'ONBOARDING',
  org_onboarding_ack_done: 'Vous avez valide l\'onboarding.',
  org_onboarding_active_path: 'Parcours actif',
  org_onboarding_path_blocks: 'Blocs du parcours',
  org_onboarding_general_info: 'Cet onboarding sera presente a tous les nouveaux collaborateurs lors de leur integration.',
  org_onboarding_role_info: 'Cet onboarding sera presente uniquement aux membres avec le role',
  org_no_onboarding_sections: 'Aucune section d\'onboarding',
  org_no_onboarding_sections_desc: 'Creez votre premiere etape d\'integration',
  org_no_role_sections: 'Aucune section pour',
  org_no_role_sections_desc: 'Creez un parcours specifique pour les',
  org_no_custom_sections: 'Aucune section',
  org_no_custom_sections_desc: 'Ajoutez des sections avec du texte, des videos ou des liens',
  org_view: 'Voir',

  // ─── CRM-specific extra ───
  crm_tag_exists: 'Ce tag existe deja',
  crm_tag_created: 'Tag cree',
  crm_tag_deleted: 'Tag supprime',
  crm_manage_tags: 'Gerer les tags',
  crm_manage_tags_desc: 'Creez et gerez vos tags pour organiser vos prospects.',
  crm_no_tags: 'Aucun tag cree',
  crm_no_prospects_found: 'Aucun prospect trouve',
  crm_7_days: '7 jours',
  crm_30_days: '30 jours',
  crm_90_days: '90 jours',
  crm_stage_prospect: 'Prospect',
  crm_stage_qualified: 'Qualifié',
  crm_stage_unqualified: 'Non qualifié',
  crm_stage_won: 'Gagné',
  crm_stage_followup: 'Suivi',
  crm_stage_noanswer: 'Sans réponse',
  crm_stage_noshow: 'No-show',
  crm_stage_lost: 'Perdu',
  crm_connected: 'Connecté',
  crm_auto_sync_in: 'Sync auto dans {time}',
  crm_your_pipeline: 'Votre pipeline',
  crm_integration: 'Intégration',
  crm_filters: 'Filtres',
  crm_export: 'Exporter',
  crm_new_prospect: 'Nouveau prospect',
  crm_reset_all: 'Tout réinitialiser',
  crm_period: 'Période',
  crm_team: 'Équipe',
  crm_closer_setter: 'Closer / Setter',
  crm_no_members: 'Aucun membre',
  crm_stage: 'Étape',
  crm_offer_formula: 'Offre / Formule',
  crm_no_formulas: 'Aucune formule',
  crm_no_tags_created: 'Aucun tag créé',
  crm_system_tag: 'Système',
  crm_no_prospect_found: 'Aucun prospect trouvé',
  crm_contact_header: 'Contact',
  crm_company_header: 'Entreprise',
  crm_email_header: 'Email',
  crm_phone_header: 'Téléphone',
  crm_stage_header: 'Étape',
  crm_tags_header: 'Tags',
  crm_value_header: 'Valeur',
  crm_date_header: 'Date',
  crm_actions_header: 'Actions',
  crm_prospects_plural: 'prospects',
  crm_prospect_singular: 'prospect',
  crm_prospect_no_name: 'Sans nom',
  crm_contact_name: 'Nom du contact',
  crm_contact_name_placeholder: 'Jean Dupont',
  crm_email_label: 'Email',
  crm_phone_label: 'Téléphone',
  crm_company_label: 'Entreprise',
  crm_offer_label: 'Offre',
  crm_no_offer: 'Aucune offre',
  crm_setter_label: 'Setter',
  crm_no_setter: 'Aucun setter',
  crm_choose_setter: 'Choisir un setter',
  crm_closer_label: 'Closer',
  crm_no_closer: 'Aucun closer',
  crm_round_robin: 'Tour par tour',
  crm_random: 'Aléatoire',
  crm_you: '(vous)',
  crm_closer_auto_assigned: 'Closer auto-assigné',
  crm_optional: '(optionnel)',
  crm_delete_tag_confirm: 'Supprimer ce tag ?',
  crm_tag_name_placeholder: 'Nom du tag',

  // ─── Appointments/Agenda extra ───
  appointments_book_later: 'A booker plus tard',

  // ─── Owner Factures ───
  owner_factures_title: 'Factures',
  owner_factures_subtitle: 'Toutes les factures de votre organisation',
  owner_factures_global: 'Global',
  owner_factures_total_billed: 'Total factur\u00e9',
  owner_factures_paid: 'Pay\u00e9',
  owner_factures_pending: 'En attente',
  owner_factures_invoice_singular: 'facture',
  owner_factures_invoices_plural: 'factures',
  owner_factures_period: 'P\u00e9riode',
  owner_factures_member: 'Membre',
  owner_factures_all_members: 'Tous les membres',
  owner_factures_status: 'Statut',
  owner_factures_all_statuses: 'Tous les statuts',
  owner_factures_th_invoice_number: 'N\u00b0 Facture',
  owner_factures_th_date: 'Date',
  owner_factures_th_client: 'Client',
  owner_factures_th_member: 'Membre',
  owner_factures_th_amount: 'Montant',
  owner_factures_th_due_date: '\u00c9ch\u00e9ance',
  owner_factures_th_status: 'Statut',
  owner_factures_th_actions: 'Actions',
  owner_factures_status_updated: 'Statut mis \u00e0 jour',
  owner_factures_late: 'Retard',
  owner_factures_link_copied: 'Lien copi\u00e9',
  owner_factures_copy_payment_link: 'Copier le lien de paiement',
  owner_factures_link: 'Lien',
  owner_factures_pay: 'Payer',
  owner_factures_view: 'Voir',
  owner_factures_download: 'T\u00e9l\u00e9charger',
  owner_factures_details: 'D\u00e9tails',
  owner_factures_empty_title: 'Aucune facture',
  owner_factures_empty_desc: 'Aucune facture sur cette p\u00e9riode',
  owner_factures_of: 'sur',
  owner_factures_status_to_pay: '\u00c0 payer',
  owner_factures_status_in_progress: 'En cours',
  owner_factures_status_paid: 'Pay\u00e9',
  owner_factures_status_sent: 'Envoy\u00e9e',
  owner_factures_status_generated: 'G\u00e9n\u00e9r\u00e9e',
  owner_factures_status_overdue: 'En retard',
  owner_factures_status_waiting: 'En attente',
  owner_factures_status_draft: 'Brouillon',

  // ─── Team Member Dashboard ───
  team_dashboard_hello: 'Bonjour',
  team_dashboard_last_sync: 'Derni\u00e8re Sync',
  team_dashboard_revenue: 'Revenue',
  team_dashboard_revenue_generated: 'CA G\u00e9n\u00e9r\u00e9',
  team_dashboard_closing_rate: 'Closing Rate',
  team_dashboard_signed: 'sign\u00e9s',
  team_dashboard_presented: 'pr\u00e9sent\u00e9s',
  team_dashboard_appointments: 'Rendez-vous',
  team_dashboard_this_month: 'Ce mois-ci',
  team_dashboard_noshow_rate: 'No-Show Rate',
  team_dashboard_absences_on: 'absences sur',
  team_dashboard_my_objectives: 'Mes Objectifs',
  team_dashboard_view_all: 'Voir tout',
  team_dashboard_expired: 'Expir\u00e9',
  team_dashboard_upcoming_appointments: 'Prochains rendez-vous',
  team_dashboard_no_upcoming_appointments: 'Aucun rendez-vous \u00e0 venir',
  team_dashboard_appointment: 'Rendez-vous',
  team_dashboard_my_reminders: 'Mes Rappels',
  team_dashboard_overdue_badge: 'RETARDS',
  team_dashboard_no_pending_reminders: 'Aucun rappel en attente',
  team_dashboard_overdue_prefix: 'Retard : ',
  team_dashboard_days_suffix: 'j',
  team_dashboard_due_prefix: '\u00c9ch\u00e9ance : ',
  team_dashboard_today_short: 'AUJ',
  team_dashboard_tomorrow_short: 'DEM',
  team_dashboard_active_campaigns: 'Campagnes actives',
  team_dashboard_assigned_to: 'Vous \u00eates actuellement affect\u00e9 \u00e0',
  team_dashboard_campaign_singular: 'campagne',
  team_dashboard_campaigns_plural: 'campagnes',
  team_dashboard_leads_total: 'leads au total',
  team_dashboard_member_fallback: 'Membre',
  team_dashboard_org_fallback: 'Organisation',

  // ─── Stripe Match Modal ───
  stripe_match_title: 'Lier un abonnement Stripe',
  stripe_match_search_by_email: 'Recherche par email',
  stripe_match_manual_entry: 'Saisie manuelle',
  stripe_match_email_placeholder: 'Email du client Stripe',
  stripe_match_no_results: 'Aucun client Stripe trouvé pour cet email.',
  stripe_match_enter_ids_manually: 'Saisir les IDs manuellement',
  stripe_match_no_subscription: 'Aucun abonnement',
  stripe_match_per_month: 'mois',
  stripe_match_per_year: 'an',
  stripe_match_customer_id: 'Customer ID Stripe',
  stripe_match_subscription_id: 'Subscription ID Stripe',
  stripe_match_link_subscription: 'Lier cet abonnement',

  // ─── Team Role Page ───
  team_role_global_view: 'Vue globale',
  team_role_no_member_found: 'Aucun membre trouvé',
  team_role_no_member_desc: 'Aucun membre avec ce rôle dans votre équipe. Invitez des membres depuis la page Équipe.',
  team_role_in_team_since: "Dans l'équipe depuis",
  team_role_prospects_assigned: 'prospect assigné',
  team_role_prospects_assigned_plural: 'prospects assignés',
  team_role_sales_count: 'vente',
  team_role_sales_count_plural: 'ventes',
  team_role_slots_count: 'créneau',
  team_role_slots_count_plural: 'créneaux',
  team_role_absences_recorded: 'absence enregistrée',
  team_role_absences_recorded_plural: 'absences enregistrées',
  team_role_global_summary: 'Résumé global',
  team_role_assigned_prospects: 'Prospects assignés',
  team_role_sales_label: 'Ventes',
  team_role_ca_generated: 'CA généré',
  team_role_conversion_rate: 'Taux de conversion',
  team_role_no_birthdate: 'Date de naissance non renseignée',
  team_role_arrival_on: 'Arrivée le',
  team_role_connection: 'Connexion',
  team_role_disconnection: 'Déconnexion',
  team_role_connection_history: 'Historique de connexion',
  team_role_last_7_days: '7 derniers jours',
  team_role_no_connection_history: 'Aucun historique de connexion',
  team_role_monthly_pay_date: 'Date de paiement mensuel',
  team_role_the_day: 'Le',
  team_role_each_month: 'de chaque mois',
  team_role_next_payment_on: 'Prochain paiement le',
  team_role_conversion: 'Conversion',
  team_role_lost: 'Perdus',
  team_role_pipeline: 'Pipeline',
  team_role_total: 'total',
  team_role_availability: 'Disponibilité',
  team_role_no_slots: 'Aucun créneau configuré',
  team_role_no_availability_desc: "Le membre n'a pas encore renseigné ses disponibilités",
  team_role_absences: 'Absences',
  team_role_no_absences: 'Aucune absence enregistrée',
  team_role_upcoming_appointments: 'Rendez-vous à venir',
  team_role_rdv: 'RDV',
  team_role_no_upcoming_appointments: 'Aucun rendez-vous à venir',
  team_role_confirmed: 'Confirmé',
  team_role_done: 'Terminé',
  team_role_pending: 'En attente',
  team_role_at: 'à',
  team_role_day_mon: 'Lundi',
  team_role_day_tue: 'Mardi',
  team_role_day_wed: 'Mercredi',
  team_role_day_thu: 'Jeudi',
  team_role_day_fri: 'Vendredi',
  team_role_day_sat: 'Samedi',
  team_role_day_sun: 'Dimanche',
  team_role_stage_prospect: 'Prospect',
  team_role_stage_qualified: 'Qualifié',
  team_role_stage_followup: 'Follow Up',
  team_role_stage_won: 'Gagné',
  team_role_stage_noshow: 'No Show',
  team_role_stage_lost: 'Perdu',

  // ─── Team Kanban ───
  kanban_title: 'Organisation des équipes',
  kanban_new_team: 'Nouvelle équipe',
  kanban_team_name_placeholder: "Nom de l'équipe...",
  kanban_unassigned: 'Non assignés',
  kanban_add: 'Ajouter',
  kanban_all_assigned: 'Tous les membres sont assignés',
  kanban_create_first_team: 'Créez votre première équipe',
  kanban_no_teams: 'Aucune équipe créée',
  kanban_no_role: 'Sans rôle',
  kanban_no_members: 'Aucun membre',
  kanban_create_error: 'Erreur lors de la création',
  kanban_team_created: 'Équipe créée',
  kanban_error: 'Erreur',
  kanban_team_deleted: 'Équipe supprimée',
  kanban_name_updated: 'Nom mis à jour',

  // ─── Reminder Bell ───
  reminder_bell_billing_approaching: 'Date de facturation approche',
  reminder_bell_billing_desc: 'Le {date} est votre date de facturation. Pensez à préparer vos documents.',
  reminder_bell_today_reminders: 'Rappels du jour',
  reminder_bell_view_all: 'Tout voir',
  reminder_bell_no_reminders: "Aucun rappel pour aujourd'hui",
  reminder_bell_overdue: 'En retard',
  reminder_bell_mark_done: 'Marquer comme fait',
  reminder_bell_hide: 'Masquer',
  // ─── Issuer Profiles Modal ───
  issuer_title: 'Profils Emetteur',
  issuer_subtitle: 'Gerez vos informations d\'entreprise',
  issuer_add_profile: 'Ajouter un profil emetteur',
  issuer_edit_profile: 'Modifier',
  issuer_new_profile: 'Nouveau',
  issuer_profile_name_label: 'Nom du profil (ex: Ma Boite)',
  issuer_company_name_label: 'Raison sociale',
  issuer_address_label: 'Adresse',
  issuer_city_label: 'Ville',
  issuer_zip_label: 'Code Postal',
  issuer_country_label: 'Pays',
  issuer_siret_label: 'SIRET',
  issuer_email_label: 'Email',
  issuer_phone_label: 'Telephone',
  issuer_default: 'Defaut',
  issuer_no_profiles: 'Aucun profil enregistre.',
  issuer_delete_confirm: 'Supprimer ?',
  issuer_session_expired: 'Session expiree, veuillez vous reconnecter.',
  issuer_save_error: 'Erreur lors de la sauvegarde. Verifiez votre connexion.',
  issuer_validation_error: 'Veuillez entrer au moins un nom de profil et un nom de societe',
  // ─── Payment Methods Modal ───
  payment_methods_title: 'Moyens de Paiement',
  payment_methods_add: 'Ajouter un moyen de paiement',
  payment_methods_edit_title: 'Modifier',
  payment_methods_new_title: 'Nouveau',
  payment_methods_name_label: 'Nom',
  payment_methods_type_label: 'Type',
  payment_methods_bank_label: 'Banque',
  payment_methods_bank_placeholder: 'Nom de la banque',
  payment_methods_iban_label: 'IBAN',
  payment_methods_bic_label: 'BIC',
  payment_methods_holder_label: 'Titulaire',
  payment_methods_holder_placeholder: 'Nom du titulaire',
  payment_methods_paypal_email_label: 'Email PayPal',
  payment_methods_revtag_label: 'Revtag',
  payment_methods_stripe_link_label: 'Lien de paiement Stripe',
  payment_methods_default: 'Defaut',
  payment_methods_set_default: 'Definir par defaut',
  payment_methods_delete_confirm: 'Supprimer ce moyen de paiement ?',
  payment_methods_no_methods: 'Aucun moyen de paiement.',
  payment_methods_no_methods_desc: 'Ajoutez un moyen de paiement pour vos factures.',
  payment_methods_session_expired: 'Session expiree',
  payment_methods_save_error: 'Erreur lors de la sauvegarde',
  payment_methods_name_required: 'Nom obligatoire',
  payment_methods_name_placeholder: 'Ex: Compte principal',
  // ─── Export Prospects Modal ───
  export_title: 'Exporter les prospects',
  export_filters: 'Filtres',
  export_period_label: 'Periode',
  export_period_all: 'Tout',
  export_period_today: "Aujourd'hui",
  export_period_7days: '7 jours',
  export_period_30days: '30 jours',
  export_period_90days: '90 jours',
  export_closer_setter: 'Closer / Setter',
  export_status_label: 'Statut',
  export_offer_formula: 'Offre / Formule',
  export_tags_label: 'Tags',
  export_custom_period: 'Periode personnalisee',
  export_date_from: 'Du',
  export_date_to: 'Au',
  export_columns: 'Colonnes',
  export_select_all: 'Tout selectionner',
  export_deselect_all: 'Tout deselectionner',
  export_col_name: 'Nom',
  export_col_firstname: 'Prenom',
  export_col_lastname: 'Nom de famille',
  export_col_email: 'Email',
  export_col_phone: 'Telephone',
  export_col_company: 'Entreprise',
  export_col_stage: 'Etape',
  export_col_value: 'Valeur',
  export_col_offer: 'Formule',
  export_col_created: 'Date de creation',
  export_col_notes: 'Notes',
  export_button: 'Exporter',
  export_toast: 'prospects exportes',
  export_stage_prospect: 'Prospect',
  export_stage_qualified: 'Qualifie',
  export_stage_unqualified: 'Non-Qualifie',
  export_stage_won: 'Gagne',
  export_stage_followup: 'Follow Up',
  export_stage_noanswer: 'Pas de Reponse',
  export_stage_noshow: 'No Show',
  export_stage_lost: 'Perdu',
  export_stage_label_prospect: 'Prospect',
  export_stage_label_qualified: 'Qualifie',
  export_stage_label_unqualified: 'Non qualifie',
  export_stage_label_won: 'Gagne',
  export_stage_label_followup: 'Suivi',
  export_stage_label_noanswer: 'Pas de reponse',
  export_stage_label_noshow: 'No Show',
  export_stage_label_lost: 'Perdu',
  // ─── Stripe Connect Modal ───
  stripe_connect_title: 'Connexion Stripe',
  stripe_connect_checking: 'Verification du statut...',
  stripe_connect_active: 'Compte actif',
  stripe_connect_close: 'Fermer',
  stripe_connect_disconnect: 'Deconnecter',
  stripe_connect_disconnect_confirm: 'Voulez-vous vraiment deconnecter votre compte Stripe ?',
  stripe_connect_connected: 'Connecte',
  stripe_connect_btn: 'Connecter mon compte Stripe',
  stripe_connect_redirect: 'Redirection securisee vers Stripe Connect',
  stripe_connect_error_init: "Erreur lors de l'initialisation de Stripe. Veuillez reessayer.",
  stripe_connect_error_server: 'Impossible de contacter le serveur de paiement.',
  stripe_connect_benefit_1: 'Recevez vos commissions par CB directement sur votre compte bancaire.',
  stripe_connect_benefit_2: 'Vos clients paient en 1 clic depuis le PDF de la facture.',
  stripe_connect_connected_desc: 'Votre compte Stripe est correctement relie. Vous pouvez recevoir des paiements directement sur vos factures.',
  stripe_connect_campaign_benefit_1: 'Faites payer vos rendez-vous directement via vos campagnes.',
  stripe_connect_campaign_benefit_2: 'CloseOS prélève 2% de frais de service sur chaque transaction.',
  stripe_connect_campaign_benefit_3: 'Remboursement configurable par palier + reprogrammation payante.',
  stripe_connect_campaign_connected_desc: 'Votre compte Stripe est connecté. Vous pouvez activer le paiement sur vos campagnes.',
  // ─── Issuer Profiles Modal (extra) ───
  issuer_form_title_edit: 'Modifier profil',
  issuer_form_title_new: 'Nouveau profil',
  // ─── Payment Methods Modal (extra) ───
  payment_methods_form_title_edit: 'Modifier moyen de paiement',
  payment_methods_form_title_new: 'Nouveau moyen de paiement',
  // ─── Invoice Generator Modal (extra) ───
  invoice_gen_penalty_default: 'En cas de retard de paiement, penalites de retard au taux annuel de {rate}%.\nIndemnite forfaitaire pour frais de recouvrement : {amount}.',
  invoice_gen_invoice_number_pdf: 'Numero de facture:',
  invoice_gen_from_to: 'Du {start} au {end}',
  // ─── Invoice Generator Modal ───
  invoice_gen_config_title: 'Configuration de la Facture',
  invoice_gen_invoice_number: 'Numero de Facture',
  invoice_gen_saved_profile: 'Profil Emetteur Enregistre',
  invoice_gen_manual_entry: 'Saisie manuelle...',
  invoice_gen_issuer_name: "Nom / Raison Sociale de l'Emetteur",
  invoice_gen_address: 'Adresse',
  invoice_gen_city: 'Ville',
  invoice_gen_zip: 'Code Postal',
  invoice_gen_country: 'Pays',
  invoice_gen_siret: 'SIRET',
  invoice_gen_email: 'Email',
  invoice_gen_phone: 'Telephone',
  invoice_gen_payment_method: 'Moyen de paiement principal',
  invoice_gen_bank_transfer: 'Virement Bancaire',
  invoice_gen_other_manual_link: 'Autre lien manuel',
  invoice_gen_stripe_toggle: 'Service de reglement en ligne (Stripe)',
  invoice_gen_stripe_recommended: 'Recommande',
  invoice_gen_stripe_desc: 'Ajoute un bouton de paiement securise + QR Code sur la facture pour se faire payer par CB instantanement.',
  invoice_gen_tva_toggle: 'TVA Applicable ?',
  invoice_gen_tva_desc: 'Ajouter 20% de TVA au montant de la commission',
  invoice_gen_late_penalties: 'Penalites de retard',
  invoice_gen_annual_rate: 'Taux annuel (%)',
  invoice_gen_fixed_indemnity: 'Indemnite forfaitaire (EUR)',
  invoice_gen_preview: 'Previsualiser la facture',
  invoice_gen_generating_stripe: 'Generation du lien Stripe...',
  invoice_gen_back: 'Retour',
  invoice_gen_validating: 'Validation...',
  invoice_gen_validate: 'Valider la facture',
  invoice_gen_edit_invoice: 'Modifier la facture',
  invoice_gen_doc_title: 'Titre du document',
  invoice_gen_invoice_number_label: 'Numero de facture',
  invoice_gen_due_date: 'Echeance',
  invoice_gen_closer_lines: 'Lignes Closer',
  invoice_gen_setter_lines: 'Lignes Setter',
  invoice_gen_add_closer_line: 'Ajouter une ligne Closer',
  invoice_gen_add_setter_line: 'Ajouter une ligne Setter',
  invoice_gen_add_product: 'Ajouter un produit',
  invoice_gen_description: 'Description',
  invoice_gen_subtitle_placeholder: 'Sous-titre / description (optionnel)',
  invoice_gen_qty: 'Qte',
  invoice_gen_unit_price: 'Prix unitaire (EUR)',
  invoice_gen_section_title_placeholder: 'Titre de la section',
  invoice_gen_stripe_show_toggle: 'Afficher le paiement Stripe sur la facture',
  invoice_gen_penalty_mentions: 'Mentions penalites de retard',
  invoice_gen_penalty_placeholder: 'Ex: En cas de retard de paiement...',
  invoice_gen_footer_note: 'Note libre (bas de facture)',
  invoice_gen_footer_placeholder: 'Ajouter une note, un commentaire...',
  invoice_gen_total_ht: 'Total HT',
  invoice_gen_total_ttc: 'Total TTC',
  invoice_gen_issuer_label: 'Emetteur',
  invoice_gen_receiver_label: 'Destinataire',
  invoice_gen_period_label: 'Periode:',
  invoice_gen_commission_closer: 'Commission Closer',
  invoice_gen_commission_setter: 'Commission Setter',
  invoice_gen_col_description: 'Description',
  invoice_gen_col_qty: 'Qte',
  invoice_gen_col_unit_price: 'Prix Unitaire',
  invoice_gen_col_total_ht: 'Total HT',
  invoice_gen_payment_terms: 'Conditions de reglement',
  invoice_gen_due_label: 'Echeance:',
  invoice_gen_payment_mode: 'Mode de reglement:',
  invoice_gen_bank_details: 'Coordonnees bancaires',
  invoice_gen_tva_not_applicable: 'TVA non applicable, art. 293 B du CGI',
  invoice_gen_pay_online: 'Payer en ligne',
  invoice_gen_scan_to_pay: 'Scannez pour regler par CB instantanement',
  invoice_gen_pay_now: 'Payer maintenant',
  invoice_gen_generated_by: 'Facture generee automatiquement par CloseOS',
  invoice_gen_fixed_salary: 'Salaire Fixe Mensuel',
  invoice_gen_new_line: 'Nouvelle ligne',
  invoice_gen_no_commission_error: 'Aucune commission a facturer sur cette periode',
  invoice_gen_bank_fields_error: 'Veuillez renseigner tous les champs du virement bancaire',
  invoice_gen_paypal_error: 'Veuillez renseigner votre email PayPal',
  invoice_gen_revtag_error: 'Veuillez renseigner votre Revtag',
  invoice_gen_stripe_link_error: 'Veuillez renseigner votre lien de paiement Stripe',
  invoice_gen_stripe_error: 'Erreur lors de la creation du lien Stripe. La facture sera generee sans.',
  invoice_gen_payment_server_error: 'Impossible de joindre le serveur de paiement.',
  invoice_gen_validated_toast: 'Facture validee et telechargee !',
  invoice_gen_validation_error: 'Une erreur est survenue lors de la validation.',
  // ─── CRM Integration Modal ───
  crm_integration_title: 'Integration CRM',
  crm_integration_subtitle: 'Choisissez et configurez votre CRM pour synchroniser vos donnees.',
  crm_integration_available: 'Available Integrations',
  crm_integration_connected_label: 'Connecte',
  crm_integration_builtin_crm: 'CRM Integre',
  crm_integration_builtin_desc: 'Le CRM natif CloseOS est active par defaut. Aucune configuration necessaire.',
  crm_integration_webhook_url: 'Webhook URL',
  crm_integration_webhook_paste: "Collez cette URL dans iClosed \u2192 Param\u00e8tres \u2192 D\u00e9veloppeur \u2192 Webhooks",
  crm_integration_connection: 'Connexion',
  crm_integration_connect_desc: 'Connectez votre compte pour synchroniser automatiquement vos contacts.',
  crm_integration_sync_status: 'Statut de la Synchronisation',
  crm_integration_auto_sync: 'La synchronisation auto se fait toutes les 2 minutes.',
  crm_integration_sync_now: 'Synchroniser maintenant',
  crm_integration_disconnect: 'Deconnecter',
  crm_integration_contacts_imported: 'contacts importes',
  crm_integration_deals_imported: 'deals importes',
  crm_integration_records_imported: 'enregistrements importes',
  crm_integration_updated: 'mis a jour',
  crm_integration_stage_changes_auto: 'Les changements de stage sont pousses automatiquement.',
  crm_integration_stage_mapping: 'Stage Mapping',
  crm_integration_select_stage: 'Selectionner une etape',
  crm_integration_loading: 'Chargement...',
  crm_integration_api_key_label: 'Cle API',
  crm_integration_paste_api_key: 'Collez votre cle API ici',
  crm_integration_save_key: 'Sauvegarder',
  crm_integration_instructions: "Instructions d'integration",
  crm_integration_generate_api_key: 'Generer une cle API',
  crm_integration_generate_btn: 'Generer une cle API',
  crm_integration_delete_key: 'Supprimer la cle',
  crm_integration_airtable_config: 'Configuration Airtable',
  crm_integration_base: 'Base',
  crm_integration_table: 'Table',
  crm_integration_select: 'Selectionner',
  crm_integration_field_mapping: 'Mapping des champs',
  crm_integration_not_mapped: '\u2014 Non mappe \u2014',
  crm_integration_stage_mapping_label: 'Mapping des etapes',
  crm_integration_save_config: 'Sauvegarder la configuration',
  crm_integration_saving: 'Enregistrement...',
  crm_integration_pipeline_mapping: 'Pipeline & Mapping',
  crm_integration_select_pipeline: 'Selectionner un pipeline',
  crm_integration_csv_export_title: 'Exporter le CRM',
  crm_integration_csv_export_desc: 'Telechargez tous vos prospects au format CSV',
  crm_integration_csv_export_btn: 'Exporter en CSV',
  crm_integration_csv_import_title: 'Importer des prospects',
  crm_integration_csv_import_desc: 'Importez un fichier CSV pour creer des prospects dans votre CRM.',
  crm_integration_csv_importing: 'Import en cours...',
  crm_integration_csv_choose_file: 'Choisir un fichier CSV',
  crm_integration_csv_imported: 'prospects importes',
  crm_integration_csv_skipped: 'lignes ignorees (donnees manquantes)',
  crm_integration_csv_defaulted: 'statuts non reconnus \u2192 mis en "Prospect"',
  crm_integration_csv_warning: 'Les statuts non reconnus seront automatiquement assignes au statut "Prospect". Utilisez de preference les statuts exacts :',
  crm_integration_csv_format_title: 'Format attendu du CSV',
  crm_integration_csv_col: 'Colonne',
  crm_integration_csv_required: 'Requis',
  crm_integration_csv_example: 'Exemple',
  crm_integration_csv_yes: 'Oui',
  crm_integration_csv_no: 'Non',
  crm_integration_csv_note: 'Les colonnes sont detectees automatiquement par leurs en-tetes.',
  crm_integration_csv_separator: 'Separateur : virgule ou point-virgule.',
  crm_integration_csv_ai_title: "Votre CSV n'est pas au bon format ?",
  crm_integration_csv_ai_desc: 'Copiez ce prompt dans ChatGPT avec votre fichier :',
  crm_integration_close_btn: 'Fermer',
  crm_integration_save_btn: 'Enregistrer',
  crm_integration_saving_btn: 'Enregistrement...',
  crm_integration_firstname: 'Prenom',
  crm_integration_lastname: 'Nom',
  crm_integration_email_field: 'Email',
  crm_integration_phone_field: 'Telephone',
  crm_integration_company_field: 'Entreprise',
  crm_integration_stage_field: 'Etape',
  crm_integration_value_field: 'Valeur',
  // ─── Closer Call Details ───
  closer_calldetails_objection_think: 'Je dois y réfléchir', closer_calldetails_objection_budget: 'Argent/budget', closer_calldetails_objection_discuss: 'Doit en parler', closer_calldetails_objection_timing: "C'est pas le moment", closer_calldetails_objection_fear: 'Peur', closer_calldetails_objection_smokescreen: 'Ecran de fumée', closer_calldetails_objection_other: 'Autre',
  closer_calldetails_outcome_won: 'Vente', closer_calldetails_outcome_followup: 'Follow up', closer_calldetails_outcome_lost: 'Perdu', closer_calldetails_outcome_noshow: 'No Show',
  closer_calldetails_setter_qualified: 'Qualifié', closer_calldetails_setter_booklater: 'À booker plus tard', closer_calldetails_setter_unqualified: 'Non Qualifié', closer_calldetails_setter_noanswer: 'Pas de Réponse',
  closer_calldetails_not_found: 'Appel introuvable', closer_calldetails_back_to_calls: 'Retour aux appels', closer_calldetails_back: 'Retour', closer_calldetails_readonly_banner: 'Mode consultation — Cet appel a déjà été qualifié',
  closer_calldetails_title_readonly: "Détails de l'appel avec", closer_calldetails_title_settercloser: "Résumé d'appel avec", closer_calldetails_title_closer: 'Résumé de Vente avec',
  closer_calldetails_linked_offer: 'Offre liée', closer_calldetails_no_linked_offer: 'Aucune offre liée à ce prospect',
  closer_calldetails_tab_qualification: 'Qualification', closer_calldetails_tab_notes: "Notes d'appel", closer_calldetails_tab_reminder: 'Programmer un rappel',
  closer_calldetails_outcome_label_closer: "Résultat de l'appel — Closer", closer_calldetails_outcome_label_setter: "Résultat de l'appel — Setter",
  closer_calldetails_sale_details: 'Détails de la vente', closer_calldetails_sale_amount: 'Montant de la vente', closer_calldetails_payment_mode: 'Mode de paiement', closer_calldetails_payment_cash: 'Comptant', closer_calldetails_payment_installments: 'Plusieurs fois',
  closer_calldetails_installments_count: 'Nombre de mensualités', closer_calldetails_months: 'mois', closer_calldetails_amount_per_month: 'Montant par mois:',
  closer_calldetails_your_commission: 'Ta Commission', closer_calldetails_you_will_receive: 'Tu recevras:', closer_calldetails_commission_rate: 'Taux de commission:',
  closer_calldetails_stripe_linked: 'Abonnement Stripe lié', closer_calldetails_stripe_amount: 'Montant', closer_calldetails_stripe_status: 'Statut', closer_calldetails_stripe_active: 'Actif', closer_calldetails_stripe_late: 'En retard', closer_calldetails_stripe_canceled: 'Annulé', closer_calldetails_stripe_month: 'mois', closer_calldetails_stripe_year: 'an',
  closer_calldetails_stripe_link: 'Lier à Stripe', closer_calldetails_stripe_auto: 'Auto', closer_calldetails_stripe_search: 'Recherche', closer_calldetails_stripe_manual: 'Manuel',
  closer_calldetails_stripe_auto_desc: "Recherche automatique d'un abonnement Stripe lié à l'email", closer_calldetails_stripe_not_found: 'Aucun abonnement Stripe trouvé pour cet email. Essayez la recherche ou la saisie manuelle.', closer_calldetails_stripe_search_auto: 'Rechercher automatiquement',
  closer_calldetails_stripe_email_placeholder: 'Email du client Stripe', closer_calldetails_stripe_no_customer: 'Aucun client Stripe trouvé.', closer_calldetails_stripe_no_subscription: 'Aucun abonnement',
  closer_calldetails_stripe_customer_id: 'Customer ID Stripe', closer_calldetails_stripe_subscription_id: 'Subscription ID Stripe', closer_calldetails_stripe_link_btn: 'Lier cet abonnement',
  closer_calldetails_followup_title: 'Informations de suivi', closer_calldetails_followup_date: 'Date de reprogrammation', closer_calldetails_followup_reason: 'Motif du report', closer_calldetails_followup_select: 'Sélectionnez un motif', closer_calldetails_followup_specify: 'Précisez le motif',
  closer_calldetails_lost_title: 'Raison de la perte', closer_calldetails_lost_reason: 'Motif', closer_calldetails_lost_details: 'Détails', closer_calldetails_lost_details_placeholder: 'Précisez les détails...',
  closer_calldetails_auto_assign_self: 'Le prospect sera automatiquement assigné à vous en tant que Closer.',
  closer_calldetails_step1_assign: 'Étape 1 — Assigner un Closer', closer_calldetails_no_closer: "Aucun closer dans l'équipe", closer_calldetails_select_manually: 'Sélectionner manuellement', closer_calldetails_choose_closer: '-- Choisir un closer --',
  closer_calldetails_round_robin: 'Suivant (Tournante)', closer_calldetails_random: 'Hasard', closer_calldetails_available: 'Disponible',
  closer_calldetails_step2_schedule: 'Étape 2 — Programmer le RDV', closer_calldetails_loading_slots: 'Chargement des créneaux...', closer_calldetails_no_slots: 'Aucun créneau disponible pour ce closer dans les 14 prochains jours.', closer_calldetails_see_all_slots: 'Voir tous les créneaux', closer_calldetails_slot_confirmed: 'RDV confirmé',
  closer_calldetails_no_prospect: 'Aucun prospect lié', closer_calldetails_create_prospect_desc: 'Créez un prospect pour qualifier cet appel', closer_calldetails_label_name: 'Nom', closer_calldetails_label_email: 'Email', closer_calldetails_label_phone: 'Téléphone', closer_calldetails_label_company: 'Entreprise', closer_calldetails_creating: 'Création...', closer_calldetails_create_prospect: 'Créer le prospect',
  closer_calldetails_notes_label: "Historique et Notes de l'appel", closer_calldetails_notes_placeholder: "Prenez vos notes ici. Elles seront enregistrées dans l'historique des appels...", closer_calldetails_notes_info: "Ces notes s'ajouteront à l'historique des appels du prospect.",
  closer_calldetails_reminder_title: 'Programmer un rappel', closer_calldetails_reminder_label_title: 'Titre', closer_calldetails_reminder_label_desc: 'Description', closer_calldetails_reminder_optional: '(optionnel)', closer_calldetails_reminder_label_date: 'Date', closer_calldetails_reminder_label_time: 'Heure', closer_calldetails_reminder_saving: 'Enregistrement...', closer_calldetails_reminder_save: 'Enregistrer le rappel',
  closer_calldetails_cancel: 'Annuler', closer_calldetails_saving: 'Enregistrement...', closer_calldetails_save_all: 'Tout Enregistrer',
  closer_calldetails_toast_saved: 'Sauvegardé', closer_calldetails_toast_save_error: 'Erreur lors de la sauvegarde', closer_calldetails_toast_reminder_saved: 'Rappel programmé', closer_calldetails_toast_reminder_error: 'Erreur lors de la création du rappel', closer_calldetails_toast_no_closer: 'Aucun closer disponible', closer_calldetails_toast_slots_error: 'Erreur lors du chargement des créneaux', closer_calldetails_toast_prospect_created: "Prospect créé et lié à l'appel", closer_calldetails_toast_prospect_error: 'Erreur lors de la création du prospect',
  closer_calldetails_toast_stripe_auto: 'Abonnement Stripe lié automatiquement', closer_calldetails_toast_stripe_success: 'Abonnement Stripe lié avec succès', closer_calldetails_toast_stripe_fail: "Impossible de lier l'abonnement", closer_calldetails_toast_stripe_error: 'Erreur de liaison Stripe', closer_calldetails_toast_stripe_manual: 'Abonnement Stripe lié manuellement',
  closer_calldetails_company_placeholder: "Nom de l'entreprise", closer_calldetails_reminder_title_placeholder: 'Ex: Rappeler Jean pour le contrat', closer_calldetails_reminder_desc_placeholder: 'Détails supplémentaires...', closer_calldetails_followup_other_placeholder: 'Ex: Indisponibilité exceptionnelle...',
  closer_calldetails_at: 'à',
  // ─── Setter Call Details ───
  setter_calldetails_not_found: 'Appel introuvable', setter_calldetails_back_to_calls: 'Retour aux appels', setter_calldetails_back: 'Retour', setter_calldetails_readonly_banner: 'Mode consultation — Cet appel a déjà été qualifié',
  setter_calldetails_title_readonly: "Détails de l'appel avec", setter_calldetails_title_default: 'Qualifiez votre appel avec',
  setter_calldetails_tab_qualification: 'Qualification', setter_calldetails_tab_notes: "Notes d'appel", setter_calldetails_tab_reminder: 'Programmer un rappel',
  setter_calldetails_outcome_label: "Résultat de l'appel", setter_calldetails_outcome_qualified: 'Qualifié', setter_calldetails_outcome_booklater: 'À booker plus tard', setter_calldetails_outcome_unqualified: 'Non Qualifié', setter_calldetails_outcome_noanswer: 'Pas de Réponse',
  setter_calldetails_step1_assign: 'Étape 1 — Assigner un Closer', setter_calldetails_no_closer: "Aucun closer dans l'équipe", setter_calldetails_select_manually: 'Sélectionner manuellement', setter_calldetails_choose_closer: '— Choisir un closer —',
  setter_calldetails_round_robin: 'Suivant (Tournante)', setter_calldetails_random: 'Hasard', setter_calldetails_available: 'Disponible',
  setter_calldetails_step2_schedule: 'Étape 2 — Programmer le RDV', setter_calldetails_loading_slots: 'Chargement des créneaux...', setter_calldetails_no_slots: 'Aucun créneau disponible pour ce closer dans les 14 prochains jours.', setter_calldetails_see_all_slots: 'Voir tous les créneaux', setter_calldetails_slot_confirmed: 'RDV confirmé',
  setter_calldetails_notes_label: "Historique et Notes de l'appel", setter_calldetails_notes_placeholder: "Prenez vos notes ici. Elles seront enregistrées dans l'historique des appels...", setter_calldetails_notes_info: "Ces notes s'ajouteront à l'historique des appels du prospect.",
  setter_calldetails_reminder_title: 'Programmer un rappel', setter_calldetails_reminder_label_title: 'Titre', setter_calldetails_reminder_label_desc: 'Description', setter_calldetails_reminder_optional: '(optionnel)', setter_calldetails_reminder_label_date: 'Date', setter_calldetails_reminder_label_time: 'Heure', setter_calldetails_reminder_saving: 'Enregistrement...', setter_calldetails_reminder_save: 'Enregistrer le rappel',
  setter_calldetails_cancel: 'Annuler', setter_calldetails_saving: 'Enregistrement...', setter_calldetails_save_all: 'Tout Enregistrer',
  setter_calldetails_toast_saved: 'Sauvegardé', setter_calldetails_toast_save_error: 'Erreur lors de la sauvegarde', setter_calldetails_toast_reminder_saved: 'Rappel programmé', setter_calldetails_toast_reminder_error: 'Erreur lors de la création du rappel', setter_calldetails_toast_no_closer: 'Aucun closer disponible', setter_calldetails_toast_slots_error: 'Erreur lors du chargement des créneaux',
  setter_calldetails_reminder_title_placeholder: 'Ex: Rappeler Jean pour le contrat', setter_calldetails_reminder_desc_placeholder: 'Détails supplémentaires...',
  setter_calldetails_at: 'à',
  // ─── Closer Agenda ───
  closer_agenda_day_mon: 'Lun', closer_agenda_day_tue: 'Mar', closer_agenda_day_wed: 'Mer', closer_agenda_day_thu: 'Jeu', closer_agenda_day_fri: 'Ven', closer_agenda_day_sat: 'Sam', closer_agenda_day_sun: 'Dim',
  closer_agenda_status_pending: 'En attente', closer_agenda_status_confirmed: 'Confirmé', closer_agenda_status_cancelled: 'Annulé', closer_agenda_status_done: 'Terminé',
  closer_agenda_today: "Aujourd'hui", closer_agenda_view_day: 'Jour', closer_agenda_view_week: 'Semaine', closer_agenda_view_month: 'Mois',
  closer_agenda_new: 'Nouveau', closer_agenda_loading: 'Chargement...', closer_agenda_google_connected: 'Google connecté', closer_agenda_google_sync: 'Synchroniser Google',
  closer_agenda_my_agenda: 'Mon agenda', closer_agenda_all_members: 'Tous les membres',
  closer_agenda_all_day: 'Toute la journée', closer_agenda_appointment_default: 'Rendez-vous', closer_agenda_reminder_label: 'Rappel',
  closer_agenda_reminder_done: 'Terminé', closer_agenda_reminder_overdue: 'En retard', closer_agenda_reminder_upcoming: 'À venir',
  closer_agenda_join_meet: 'Rejoindre Google Meet', closer_agenda_link_copied: 'Lien copié', closer_agenda_delete: 'Supprimer',
  closer_agenda_confirm_delete_event: 'Supprimer cet événement ?', closer_agenda_event_deleted: 'Événement supprimé', closer_agenda_delete_error: 'Erreur lors de la suppression',
  closer_agenda_confirm_delete_reminder: 'Supprimer ce rappel ?', closer_agenda_reminder_deleted: 'Rappel supprimé',
  closer_agenda_confirm_delete_google: 'Supprimer cet événement de Google Calendar ?', closer_agenda_google_deleted: 'Événement supprimé de Google Calendar',
  closer_agenda_new_event: 'Nouvel événement', closer_agenda_label_title: 'Titre', closer_agenda_title_placeholder: 'Ex: Appel découverte, Point hebdo...',
  closer_agenda_date_time: 'Date & Horaire', closer_agenda_all_day_toggle: 'Toute la journée',
  closer_agenda_assign_to: 'Assigner à', closer_agenda_not_assigned: 'Non assigné', closer_agenda_assign_desc: "Choisissez un membre de l'équipe pour ce rendez-vous",
  closer_agenda_link_prospect: 'Assigné à un prospect', closer_agenda_search_prospect: 'Rechercher un prospect...', closer_agenda_no_name: 'Sans nom', closer_agenda_no_prospect_found: 'Aucun prospect trouvé',
  closer_agenda_create_meet: 'Créer un Google Meet', closer_agenda_notes_optional: 'Notes (optionnel)', closer_agenda_notes_placeholder: 'Ajouter des notes...',
  closer_agenda_cancel: 'Annuler', closer_agenda_create: 'Créer',
  closer_agenda_choose_date: 'Choisir une date', closer_agenda_event_created_meet: 'Événement créé avec Google Meet', closer_agenda_prospect_updated: 'Prospect mis à jour', closer_agenda_prospect_deleted: 'Prospect supprimé',
  closer_agenda_all_day_suffix: ', toute la journée', closer_agenda_from_to: ', de {start} à {end}', closer_agenda_day_label: 'Journée', closer_agenda_notes_section: 'Notes',
  closer_agenda_time_to: 'à',
  closer_agenda_booking_badge: 'Booking', closer_agenda_call_fallback: 'Appel', closer_agenda_copy_link: 'Copier le lien',
};

export const en: BusinessTranslations = {
  // ─── Common ───
  common_save: 'Save',
  common_cancel: 'Cancel',
  common_close: 'Close',
  common_delete: 'Delete',
  common_confirm: 'Confirm',
  common_loading: 'Loading...',
  common_error: 'Error',
  common_success: 'Success',
  common_search: 'Search',
  common_filter: 'Filter',
  common_export: 'Export',
  common_edit: 'Edit',
  common_add: 'Add',
  common_back: 'Back',
  common_next: 'Next',
  common_previous: 'Previous',
  common_yes: 'Yes',
  common_no: 'No',
  common_all: 'All',
  common_none: 'None',
  common_today: 'Today',
  common_this_week: 'This week',
  common_this_month: 'This month',
  common_this_year: 'This year',
  common_since_forever: 'All time',
  common_name: 'Name',
  common_email: 'Email',
  common_phone: 'Phone',
  common_role: 'Role',
  common_status: 'Status',
  common_date: 'Date',
  common_actions: 'Actions',
  common_no_data: 'No data available',
  common_copy: 'Copy',
  common_copied: 'Copied!',
  common_active: 'Active',
  common_inactive: 'Inactive',
  common_online: 'Online',
  common_offline: 'Offline',
  common_reset: 'Reset',
  common_or: 'or',
  common_month: 'month',
  common_quarter: 'quarter',
  common_year: 'year',

  // ─── Sidebar ───
  sidebar_dashboard: 'Dashboard',
  sidebar_crm: 'CRM',
  sidebar_pipeline: 'Pipeline',
  sidebar_campaigns: 'Campaigns',
  sidebar_acquisition: 'Acquisition',
  sidebar_objectives: 'Objectives',
  sidebar_formulas: 'Plans',
  sidebar_calls: 'Calls',
  sidebar_appointments: 'Appointments',
  sidebar_agenda: 'Calendar',
  sidebar_reminders: 'Reminders',
  sidebar_invoices: 'Invoices',
  sidebar_report: 'Report',
  sidebar_setter_kpi: 'Setter KPI',
  sidebar_closer_kpi: 'Closer KPI',
  sidebar_team: 'Team',
  sidebar_availability: 'Availability',
  sidebar_revenue: 'Revenue',
  sidebar_organization: 'Organization',
  sidebar_settings: 'Settings',
  sidebar_logout: 'Log out',
  sidebar_sales_crm: 'Sales CRM',
  sidebar_help: 'Help',
  sidebar_personal: 'Personal',
  sidebar_onboarding_required: 'Please complete the onboarding to access the platform.',
  sidebar_secure_logout: 'Signing out securely...',
  sidebar_my_org: 'My organization',
  sidebar_member: 'Member',

  // ─── Settings Modal ───
  settings_title: 'Settings',
  settings_tab_profile: 'Profile',
  settings_tab_security: 'Security',
  settings_tab_interface: 'Interface',
  settings_tab_devices: 'Devices',
  settings_tab_organisation: 'Organization',
  settings_tab_support: 'Support',
  settings_tab_delete: 'Delete account',
  settings_profile_name: 'Full name',
  settings_profile_phone: 'Phone',
  settings_profile_role: 'Role',
  settings_profile_avatar: 'Profile picture',
  settings_profile_save: 'Save',
  settings_profile_saved: 'Profile updated!',
  settings_security_current_pw: 'Current password',
  settings_security_new_pw: 'New password',
  settings_security_confirm_pw: 'Confirm password',
  settings_security_change: 'Change password',
  settings_interface_title: 'Interface',
  settings_dark_mode: 'Dark mode',
  settings_dark_mode_desc: 'Toggle between light and dark theme',
  settings_language: 'Language',
  settings_language_desc: 'Choose the interface language',
  settings_language_fr: 'Francais',
  settings_language_en: 'English',
  settings_dashboard_period: 'Dashboard Period',
  settings_dashboard_period_desc: 'Choose the default period for KPIs displayed on the dashboard.',
  settings_sidebar_order: 'Sidebar layout',
  settings_sidebar_order_desc: 'Drag and drop pages to reorganize your sidebar.',
  settings_sidebar_reset: 'Reset',
  settings_devices_title: 'Connected devices',
  settings_devices_current: 'This device',
  settings_devices_revoke: 'Revoke',
  settings_devices_none: 'No connected devices',
  settings_org_leave: 'Leave organization',
  settings_org_leave_desc: 'You will lose access to all data in this organization.',
  settings_org_leave_confirm: 'Are you sure you want to leave?',
  settings_org_reset: 'Reset organization',
  settings_org_reset_desc: 'All organization data will be deleted.',
  settings_org_reset_confirm: 'This action is irreversible.',
  settings_support_email: 'support@closeos.fr',
  settings_support_desc: 'Contact us by email for any question.',
  settings_delete_title: 'Delete account',
  settings_delete_desc: 'This action is irreversible. All your data will be permanently deleted.',
  settings_delete_confirm: 'Confirm deletion',
  settings_delete_export_first: 'Export my data first',
  settings_assignable_label: 'Assignable',
  settings_assignable_desc: 'Allow the owner to assign prospects to you',

  // ─── Dashboard ───
  dashboard_title: 'Dashboard',
  dashboard_welcome: 'Welcome',
  dashboard_period_label: 'Period',
  dashboard_total_revenue: 'Revenue',
  dashboard_total_calls: 'Calls',
  dashboard_conversion_rate: 'Conversion rate',
  dashboard_active_prospects: 'Active prospects',
  dashboard_new_prospects: 'New prospects',
  dashboard_appointments_today: 'Appointments today',
  dashboard_team_online: 'Team online',
  dashboard_no_data: 'No data yet',
  dashboard_recent_activity: 'Recent activity',
  dashboard_top_performers: 'Top performers',
  dashboard_revenue_chart: 'Revenue trend',
  dashboard_calls_chart: 'Calls trend',
  dashboard_hello: 'Hello',
  dashboard_subtitle: 'Here is the state of your activity',
  dashboard_export_report: 'Export',
  dashboard_export_modal_title: 'Export report',
  dashboard_export_modal_subtitle: 'Choose the format and period, the report will be sent by email.',
  dashboard_export_format: 'Format',
  dashboard_export_period: 'Period',
  dashboard_export_period_week: 'Week',
  dashboard_export_period_month: 'Month',
  dashboard_export_period_quarter: 'Quarter',
  dashboard_export_period_year: 'Year',
  dashboard_export_period_all: 'All time',
  dashboard_export_send: 'Send by email',
  dashboard_export_sending: 'Sending...',
  dashboard_export_success: 'Report sent!',
  dashboard_export_success_desc: 'Check your inbox.',
  dashboard_export_error: 'Error sending report',
  dashboard_export_select_format: 'Select at least one format',
  dashboard_tooltip_revenue: 'Total revenue generated by won prospects (Won stage). Calculated by adding the value of each signed prospect.',
  dashboard_tooltip_pipeline: 'Total value of all active prospects in the pipeline (all statuses). Represents the overall business potential.',
  dashboard_tooltip_closing: 'Closing rate: percentage of prospects converted into sales. Calculated: won / (won + lost + no-shows with appointments).',
  dashboard_tooltip_appointments: 'Total number of upcoming scheduled appointments (confirmed and pending) from today.',
  dashboard_tooltip_objective: 'Progress towards your revenue objective. Calculated: current revenue / defined target x 100.',
  dashboard_tooltip_noshow: 'No-show rate: percentage of prospects absent from appointments.',
  dashboard_tooltip_health: 'Overall health based on closing rate',
  dashboard_kpi_health: 'KPI Health',
  dashboard_health_optimal: 'Optimal',
  dashboard_health_medium: 'Average',
  dashboard_health_low: 'Low',
  dashboard_objective_ca: 'Revenue Goal',
  dashboard_on_track: 'On track',
  dashboard_in_progress: 'In progress',
  dashboard_active_campaigns: 'Active Campaigns',
  dashboard_active_campaigns_desc: 'Real-time performance of active flows.',
  dashboard_sales_objectives: 'Sales Objectives',
  dashboard_objectives_desc: 'Monthly progress towards objectives.',
  dashboard_no_objectives: 'No objectives defined',
  dashboard_alert_efficiency: 'Efficiency Alert',
  dashboard_alert_efficiency_desc: 'The closing rate is below average. Consider scheduling a training session.',
  dashboard_teams: 'Teams',
  dashboard_view_team: 'View team',
  dashboard_no_members: 'No members',
  dashboard_no_members_in_team: 'No members in this team',
  dashboard_no_teams: 'No teams created',
  dashboard_revenue_generated: 'Revenue generated',
  dashboard_loss_reasons: 'Loss Reasons',
  dashboard_reminder_detail: 'Reminder Detail',
  dashboard_upcoming: 'Upcoming',
  dashboard_title_label: 'Title',
  dashboard_date_time: 'Date & Time',
  dashboard_mark_done: 'Mark as done',

  // ─── CRM ───
  crm_title: 'CRM',
  crm_search_placeholder: 'Search a prospect...',
  crm_add_prospect: 'Add prospect',
  crm_no_prospects: 'No prospects yet',
  crm_status_new: 'New',
  crm_status_contacted: 'Contacted',
  crm_status_qualified: 'Qualified',
  crm_status_proposal: 'Proposal',
  crm_status_won: 'Won',
  crm_status_lost: 'Lost',
  crm_status_no_show: 'No Show',
  crm_filter_all: 'All',
  crm_filter_mine: 'My prospects',
  crm_sort_recent: 'Most recent',
  crm_sort_name: 'By name',
  crm_sort_amount: 'By amount',
  crm_assigned_to: 'Assigned to',
  crm_unassigned: 'Unassigned',
  crm_last_contact: 'Last contact',
  crm_created_at: 'Created',
  crm_notes: 'Notes',
  crm_add_note: 'Add note',
  crm_amount: 'Amount',

  // ─── Pipeline ───
  pipeline_title: 'Pipeline',
  pipeline_owner_title: 'Owner Pipeline',
  pipeline_filter_member: 'Filter by member',
  pipeline_total: 'Total',
  pipeline_drag_hint: 'Drag and drop to move',

  // ─── Team ───
  team_title: 'Team',
  team_invite: 'Invite member',
  team_invite_link: 'Invitation link',
  team_members: 'Members',
  team_role_owner: 'Owner',
  team_role_admin: 'Admin',
  team_role_hos: 'Head of Sales',
  team_role_closer: 'Closer',
  team_role_setter: 'Setter',
  team_role_setter_closer: 'Setter-Closer',
  team_seats_used: 'Seats used',
  team_seats_available: 'Seats available',
  team_buy_seats: 'Buy seats',
  team_remove_member: 'Remove member',
  team_remove_confirm: 'Are you sure? All data for this member will be deleted.',
  team_last_seen: 'Last seen',
  team_joined: 'Joined',
  team_pending_invites: 'Pending invitations',
  team_member_count: 'member',
  team_member_count_plural: 'members',
  team_manage_subtitle: 'Manage your team and view detailed profiles',
  team_back_to_team: 'Back to team',
  team_delete: 'Delete',
  team_phone_updated: 'Phone number updated',
  team_not_provided: 'Not provided',
  team_link_copied: 'Link copied',
  team_booking_links: 'Booking Links',
  team_no_booking_links: 'No booking links',
  team_copy_link: 'Copy link',
  team_open: 'Open',
  team_prospect_count: 'prospect',
  team_sale_count: 'sale',
  team_slot_count: 'slot',
  team_absence_count: 'absence',
  team_status_absent: 'Absent',
  team_status_online: 'Online',
  team_status_offline: 'Offline',
  team_no_role: 'No role',
  team_today: 'Today',
  team_days: 'day',
  team_months: 'month',
  team_years: 'year',
  team_day_mon: 'Monday',
  team_day_tue: 'Tuesday',
  team_day_wed: 'Wednesday',
  team_day_thu: 'Thursday',
  team_day_fri: 'Friday',
  team_day_sat: 'Saturday',
  team_day_sun: 'Sunday',
  team_pipeline_stages_prospect: 'Prospect',
  team_pipeline_stages_qualified: 'Qualified',
  team_pipeline_stages_followup: 'Follow Up',
  team_pipeline_stages_won: 'Won',
  team_pipeline_stages_noshow: 'No Show',
  team_pipeline_stages_lost: 'Lost',
  team_role_change_error: 'Error changing role',
  team_role_updated: 'Role updated',
  team_pay_date_updated: 'Pay date updated',
  team_role_management: 'Role Management',
  team_role_assignment: 'Assignment',
  team_scope_visibility: 'Visibility scope',
  team_scope_self: 'Self only',
  team_scope_team: 'Team',
  team_scope_self_desc: 'This member only sets for their own appointments.',
  team_scope_team_desc: 'This member sets for all closers on the team.',
  team_save: 'Save',
  team_compensation: 'Compensation',
  team_compensation_type: 'Compensation type',
  team_comp_commission: 'Commission',
  team_comp_fixed: 'Fixed',
  team_comp_fixed_plus_commission: 'Fixed + Commission',
  team_fixed_salary_monthly: 'Monthly fixed salary (€)',
  team_fixed_salary_placeholder: 'e.g.: 2000',
  team_setter_commissions: 'Setting commissions',
  team_setter_commissions_desc: 'Count their commissions as setter',
  team_compensation_updated: 'Compensation updated',
  team_pay_date: 'Pay date',
  team_pay_date_desc: 'Day of the month for commission payments.',
  team_pay_date_day: 'The {day}th of the month',
  team_next_payment: 'Next payment on the',
  team_bonuses: 'Bonuses',
  team_bonus_add: 'Add',
  team_bonus_label_placeholder: 'Label (e.g.: Q1 performance bonus)',
  team_bonus_amount_placeholder: 'Amount',
  team_bonus_link_invoice: 'Linked to a paid invoice (optional)',
  team_bonus_no_invoice: 'No invoice',
  team_bonus_link_invoice_desc: 'If linked to an invoice, the bonus will be paid once the invoice is marked as paid.',
  team_bonus_cancel: 'Cancel',
  team_bonus_none: 'No bonuses',
  team_bonus_added: 'Bonus added',
  team_bonus_deleted: 'Bonus deleted',
  team_bonus_marked_paid: 'Bonus marked as paid',
  team_bonus_mark_paid: 'Mark as paid',
  team_bonus_status_paid: 'Paid',
  team_bonus_status_pending: 'Pending',
  team_bonus_total: 'Total bonuses',
  team_connection_history: 'Last week',
  team_last_week: 'Last week',
  team_no_history: 'No history',
  team_log_in: 'Log In',
  team_log_out: 'Log Out',
  team_pipeline_distribution: 'Pipeline Distribution',
  team_weekly_slots: 'Weekly Slots',
  team_no_slots: 'No slots configured',
  team_unavailable: 'Unavailable',
  team_planned_absences: 'Planned Absences',
  team_no_absences: 'No absences',
  team_absence_label: 'Absence',
  team_upcoming_appointments: 'Upcoming Appointments',
  team_no_upcoming_appointments: 'No upcoming appointments',
  team_th_prospect: 'Prospect',
  team_th_date: 'Date',
  team_th_status: 'Status',
  team_appt_appointment: 'Appt',
  team_appt_at_member: 'at',
  team_appt_confirmed: 'Confirmed',
  team_appt_done: 'Done',
  team_appt_pending: 'Pending',
  team_label_email: 'Email',
  team_label_whatsapp: 'WhatsApp',
  team_label_birthday: 'Birthday',
  team_label_arrival: 'Arrival',
  team_label_prospects: 'Prospects',
  team_label_sales: 'Sales',
  team_label_revenue: 'Revenue Generated',
  team_label_conversion: 'Conversion',
  team_label_noshow: 'No Show',
  team_label_lost: 'Lost',
  team_years_old: 'years old',
  team_delete_error: 'Error deleting member',
  team_error: 'Error',

  // ─── Campaigns ───
  campaigns_title: 'Campaigns',
  campaigns_subtitle: 'Manage your conversion funnels and capture pages from a centralized dashboard.',
  campaigns_new: 'New campaign',
  campaigns_create: 'Create',
  campaigns_create_first: 'Create a campaign',
  campaigns_save: 'Save',
  campaigns_creating: 'Creating...',
  campaigns_name: 'Campaign name',
  campaigns_name_required: 'Name is required',
  campaigns_status: 'Status',
  campaigns_views: 'Views',
  campaigns_leads: 'Leads',
  campaigns_conversion: 'Conversion',
  campaigns_active: 'Active',
  campaigns_inactive: 'Inactive',
  campaigns_paused: 'Paused',
  campaigns_edit: 'Edit',
  campaigns_duplicate: 'Duplicate',
  campaigns_delete: 'Delete',
  campaigns_delete_confirm: 'Delete campaign',
  campaigns_no_campaigns: 'No campaigns',
  campaigns_empty_desc: 'Create your first campaign to capture leads',
  campaigns_created: 'Campaign created',
  campaigns_modified: 'Campaign updated',
  campaigns_deleted: 'Campaign deleted',
  campaigns_activated: 'Campaign activated',
  campaigns_deactivated: 'Campaign deactivated',
  campaigns_copied: 'copied!',
  campaigns_network_error: 'Network error',
  campaigns_creation_error: 'Error during creation',
  campaigns_source_created: 'Source created',
  campaigns_config_title: 'Campaign Configuration',
  campaigns_new_title: 'New Campaign',
  campaigns_tab_general: 'General',
  campaigns_tab_landing: 'Capture page',
  campaigns_tab_fields: 'Fields & Options',
  campaigns_tab_qualification: 'Qualification',
  campaigns_tab_booking: 'Booking',
  campaigns_tab_assignation: 'Assignment',
  campaigns_tab_payment: 'Payment',
  campaigns_stripe_integration: 'Stripe Integration',
  campaigns_stripe_not_connected: 'Stripe account not connected',
  campaigns_stripe_connect_first: 'Connect your Stripe account to enable payments.',
  campaigns_stripe_price: 'Price',
  campaigns_stripe_currency: 'Currency',
  campaigns_stripe_fee_notice: 'CloseOS charges a 2% service fee on each transaction.',
  campaigns_payment_timing: 'Payment timing',
  campaigns_payment_before: 'Before registration',
  campaigns_payment_after: 'After registration',
  campaigns_payment_before_desc: 'The prospect pays before filling out the form.',
  campaigns_payment_after_desc: 'The prospect fills out the form then pays.',
  campaigns_refund_enabled: 'Refunds enabled',
  campaigns_refund_tiers: 'Refund tiers',
  campaigns_refund_days_before: 'days before appointment',
  campaigns_refund_percent: '% refunded',
  campaigns_refund_add_tier: 'Add a tier',
  campaigns_refund_remove_tier: 'Remove',
  campaigns_reschedule_enabled: 'Rescheduling allowed',
  campaigns_reschedule_free: 'Free',
  campaigns_reschedule_paid: 'Paid',
  campaigns_reschedule_price: 'Reschedule price',
  campaigns_identification: 'Identification',
  campaigns_assigned_team: 'Assigned team',
  campaigns_all_team: 'Whole team',
  campaigns_team_hint: 'Bookings and assignments will be limited to members of this team.',
  campaigns_capture_type: 'Capture Type',
  campaigns_appointment: 'Appointment',
  campaigns_direct_planning: 'Direct scheduling',
  campaigns_registration: 'Registration',
  campaigns_classic_form: 'Classic form',
  campaigns_rdv: 'Appointment',
  campaigns_source: 'Source',
  campaigns_new_source: 'New source',
  campaigns_source_name: 'Source name',
  campaigns_internal_desc: 'Internal description',
  campaigns_internal_note: 'Internal note...',
  campaigns_utm_params: 'UTM Parameters',
  campaigns_associated_formula: 'Associated formula',
  campaigns_no_formula: 'No formula',
  campaigns_formula_hint: 'Prospects captured via this campaign will be associated with this formula',
  campaigns_booking_with: 'Appointment with',
  campaigns_no_rdv: 'Campaign without appointment',
  campaigns_no_rdv_desc: 'Captured leads will be assigned to a Setter for processing.',
  campaigns_assign_mode: 'Assignment mode for',
  campaigns_specific_member: 'Specific member',
  campaigns_all_role: 'Entire role',
  campaigns_multiple_members: 'Multiple members',
  campaigns_choose_member: 'Choose a member',
  campaigns_select_members: 'Select members to include:',
  campaigns_distribution: 'Appointment distribution',
  campaigns_round_robin: 'Round robin',
  campaigns_random: 'Random',
  campaigns_round_robin_desc: 'Appointments are distributed in turns among members.',
  campaigns_random_desc: 'Appointments are assigned randomly.',
  campaigns_landing_desc: 'Configure the content displayed on the left side of the capture page (marketing side)',
  campaigns_main_title: 'Main title',
  campaigns_main_title_placeholder: 'E.g.: Turn every lead into a customer.',
  campaigns_subtitle_label: 'Subtitle',
  campaigns_subtitle_placeholder: 'E.g.: THE SALES OPERATING SYSTEM',
  campaigns_desc_text: 'Description text',
  campaigns_desc_text_placeholder: 'Describe your offer, your value proposition...',
  campaigns_video_url: 'Video URL (YouTube, Loom...)',
  campaigns_video_hint: 'Use the embed URL. E.g.: https://www.youtube.com/embed/VIDEO_ID',
  campaigns_redirect_url: 'Post-capture redirect link',
  campaigns_redirect_hint: 'Optional — Redirects the prospect to this URL after form submission',
  campaigns_popup_config: 'Popup Configuration',
  campaigns_popup_instant: 'Appears instantly',
  campaigns_popup_after_3s: 'After 3 seconds',
  campaigns_popup_after_5s: 'After 5 seconds',
  campaigns_popup_after_10s: 'After 10 seconds',
  campaigns_popup_after_15s: 'After 15 seconds',
  campaigns_popup_after_30s: 'After 30 seconds',
  campaigns_popup_after_1m: 'After 1 minute',
  campaigns_popup_hint: "Applies when the Popup format is used. The site is blocked until the form is filled.",
  campaigns_required_fields: 'Required form fields',
  campaigns_always_required: 'Always required',
  campaigns_required: 'Required',
  campaigns_optional: 'Optional',
  campaigns_lead_email: 'Lead email address',
  campaigns_lead_phone: 'Lead phone number',
  campaigns_custom_fields: 'Custom fields',
  campaigns_add_field: 'Add field',
  campaigns_no_custom_fields: 'No custom fields. Click "Add field" to create one.',
  campaigns_field_name: 'Field name',
  campaigns_type_text: 'Text',
  campaigns_type_number: 'Number',
  campaigns_type_select: 'Select',
  campaigns_select_options: 'Select options',
  campaigns_add_option: 'Add option',
  campaigns_enable_questionnaire: 'Enable questionnaire',
  campaigns_enable_questionnaire_desc: 'Prospects will answer questions after filling in their information',
  campaigns_questionnaire_required: 'Required questionnaire',
  campaigns_questionnaire_required_desc: 'The prospect must answer before being able to book',
  campaigns_auto_qualification: 'Automatic qualification',
  campaigns_auto_qualification_desc: 'Answers are scored and prospects are automatically disqualified',
  campaigns_max_eliminatory: 'Tolerated eliminatory answers',
  campaigns_max_eliminatory_desc: 'If the prospect exceeds this number of eliminatory answers, they are automatically classified as Unqualified. (0 = no tolerance)',
  campaigns_add_question: 'Add question',
  campaigns_no_questions: 'No questions configured. Click "Add question" to start.',
  campaigns_your_question: 'Your question...',
  campaigns_counts_in_scoring: 'Counts in scoring',
  campaigns_out_of_scoring: 'Out of scoring',
  campaigns_free_text: 'Free text',
  campaigns_single_select: 'Single select',
  campaigns_multiple_choice: 'Multiple choice',
  campaigns_number: 'Number',
  campaigns_text_no_auto_eval: 'Text answers cannot be automatically evaluated',
  campaigns_answer_options: 'Answer options',
  campaigns_expected_answers: 'Expected answer(s)',
  campaigns_eliminatory_answers: 'Eliminatory answer(s)',
  campaigns_expected_value: 'Expected value (or min-max range)',
  campaigns_eliminatory_value: 'Eliminatory value (or range)',
  campaigns_value_or_min: 'Value or Min',
  campaigns_max_optional: 'Max (optional)',
  campaigns_booking_duration: 'Appointment duration',
  campaigns_booking_title_label: 'Appointment title',
  campaigns_booking_desc_label: 'Appointment description',
  campaigns_var_lead_name: 'Lead name',
  campaigns_var_lead_email: 'Lead email',
  campaigns_var_lead_phone: 'Lead phone',
  campaigns_var_assignee_name: 'Closer/setter name',
  campaigns_var_formula_name: 'Offer name',
  campaigns_var_campaign_name: 'Campaign name',
  campaigns_embed_page_desc: 'Customize and share your capture page',
  campaigns_embed_integrate_desc: 'Embed the form on your site',
  campaigns_code_tuto: 'Code & Tutorial',
  campaigns_customize: 'Customize',
  campaigns_capture_page_link: 'Capture page link',
  campaigns_open: 'Open',
  campaigns_link: 'Link',
  campaigns_custom_link: 'Custom link',
  campaigns_full_page_link: 'Full page link',
  campaigns_font: 'Font',
  campaigns_primary_color: 'Primary color',
  campaigns_background: 'Background',
  campaigns_text_color: 'Text',
  campaigns_border_radius: 'Rounded',
  campaigns_border_radius_corners: 'Corner radius',
  campaigns_square: 'Square',
  campaigns_rounded: 'Rounded',
  campaigns_layout: 'Layout',
  campaigns_vertical: 'Vertical',
  campaigns_horizontal: 'Horizontal',
  campaigns_copy_custom_link: 'Copy custom link',
  campaigns_live_preview: 'Live preview',
  campaigns_how_it_works: 'How it works',
  campaigns_popup_step1_prefix: 'The popup appears ',
  campaigns_popup_step1_after: 'after',
  campaigns_popup_step1_seconds: 'seconds',
  campaigns_popup_step1_instant: 'instantly',
  campaigns_popup_step1_suffix: ' when the page loads',
  campaigns_popup_step2: 'The site is blocked (scroll disabled, dark overlay) until the form is filled',
  campaigns_popup_step3: 'Once the form is submitted, the popup disappears and the visitor can browse normally',
  campaigns_popup_step4: 'The visitor will not see the popup again thanks to localStorage',
  campaigns_popup_step5_prefix: 'Paste the code just before the',
  campaigns_popup_step5_suffix: 'tag of your site',
  campaigns_iframe_step1: 'Copy the iframe code below',
  campaigns_iframe_step2: 'Paste it in your page HTML where you want to display the form',
  campaigns_iframe_step3: 'Adjust the height if necessary',
  campaigns_iframe_step4: 'The form automatically adapts to the container width',
  campaigns_code_to_embed: 'Code to embed',
  campaigns_copy_code: 'Copy code',
  campaigns_copy_full_page_link: 'Copy full page link',
  campaigns_style: 'Style',

  // ─── Acquisition ───
  acquisition_title: 'Acquisition',
  acquisition_total_views: 'Total views',
  acquisition_total_leads: 'Total leads',
  acquisition_conversion_rate: 'Conversion rate',
  acquisition_by_campaign: 'By campaign',
  acquisition_by_source: 'By source',
  acquisition_chart_views: 'Views',
  acquisition_chart_leads: 'Leads',
  acquisition_subtitle: 'Strategic monitoring of acquisition flows and real-time conversion for the current quarter.',
  acquisition_active_campaigns: 'Active Campaigns',
  acquisition_total_views_label: 'Total Views',
  acquisition_registration_rate: 'Registration Rate',
  acquisition_leads_views: 'leads / {views} views',
  acquisition_ca_generated: 'Revenue Generated',
  acquisition_clients_won: 'client won',
  acquisition_clients_won_plural: 'clients won',
  acquisition_performance_by_campaign: 'Performance by Campaign',
  acquisition_granular_details: 'Granular details of active flows',
  acquisition_active: 'Active',
  acquisition_inactive: 'Inactive',
  acquisition_views_label: 'Views',
  acquisition_leads_label: 'Leads',
  acquisition_conversion_rate_label: 'Conversion Rate',
  acquisition_distribution_by_campaign: 'Distribution by campaign',
  acquisition_most_viewed: 'Most viewed',
  acquisition_most_converted: 'Most converted',
  acquisition_no_data: 'No data',
  acquisition_views_tooltip: 'views',
  acquisition_client_conversion: 'Client Conversion (%)',
  acquisition_ca_by_campaign: 'Revenue by campaign',
  acquisition_projection_vs_actual: 'Gross projection vs actual by channel',
  acquisition_actual: 'Actual',
  acquisition_implication_rate: 'Implication Rate (%)',
  acquisition_implication_desc: 'Reduction of no-shows and no-answers',
  acquisition_education_rate: 'Education Rate (%)',
  acquisition_education_desc: 'Lead quality (lowest unqualified)',
  acquisition_include_noanswer_noshow: 'Include "No Answer" and "No Show"',
  acquisition_empty_title: 'No acquisition data',
  acquisition_empty_desc: 'Create campaigns and share your capture pages to see statistics here.',

  // ─── Objectives ───
  objectives_title: 'Objectives',
  objectives_add: 'Add objective',
  objectives_target: 'Target',
  objectives_current: 'Current',
  objectives_progress: 'Progress',
  objectives_assign_to: 'Assign to',
  objectives_type_calls: 'Calls',
  objectives_type_revenue: 'Revenue',
  objectives_type_prospects: 'Prospects',
  objectives_type_conversion: 'Conversion rate',
  objectives_no_objectives: 'No objectives',
  objectives_personal: 'Personal',
  objectives_team: 'Team',
  objectives_cycle: 'Cycle',
  objectives_daily: 'Daily',
  objectives_weekly: 'Weekly',
  objectives_monthly: 'Monthly',
  objectives_my_title: 'My objectives',
  objectives_subtitle: 'Track and achieve your sales objectives.',
  objectives_new_objective: 'New objective',
  objectives_tab_assigned: 'Assigned',
  objectives_tab_org: 'Organization',
  objectives_tab_personal: 'Personal',
  objectives_no_org: 'No organization objectives',
  objectives_no_org_desc: 'No organization objectives have been set.',
  objectives_no_assigned: 'No assigned objectives',
  objectives_no_assigned_desc: 'No objectives have been assigned to you yet.',
  objectives_no_personal: 'No personal objectives',
  objectives_no_personal_desc: 'Set your first objectives to track your progress.',
  objectives_create_first: 'Create my first objective',
  objectives_percent_reached: 'reached',
  objectives_overdue: 'Overdue',
  objectives_deadline: 'Deadline',
  objectives_visible_to_manager: 'Visible to manager',
  objectives_private: 'Private',
  objectives_edit_title: 'Edit objective',
  objectives_new_personal: 'New personal objective',
  objectives_label_required: 'Title is required',
  objectives_label_name: 'Name',
  objectives_label_name_placeholder: 'E.g.: Reach 50k€ revenue',
  objectives_label_metric: 'Metric',
  objectives_label_description: 'Description',
  objectives_label_description_placeholder: 'Describe your objective...',
  objectives_label_target: 'Target value',
  objectives_label_target_placeholder: '0',
  objectives_label_period: 'Period',
  objectives_label_deadline: 'Deadline',
  objectives_visibility_visible: 'Visible',
  objectives_visibility_visible_desc: 'Visible to your manager',
  objectives_visibility_private: 'Private',
  objectives_visibility_private_desc: 'Only you can see this objective',
  objectives_modified: 'Objective updated',
  objectives_created: 'Objective created',
  objectives_deleted: 'Objective deleted',
  objectives_delete_confirm: 'Delete objective "{label}"?',
  objectives_network_error: 'Network error',
  objectives_metric_revenue: 'Revenue',
  objectives_metric_sales_count: 'Sales count',
  objectives_metric_conversion_rate: 'Conversion rate',
  objectives_metric_leads: 'Leads',
  objectives_metric_appointments: 'Appointments',
  objectives_metric_noshow_rate: 'No-show rate',
  objectives_metric_custom: 'Custom',
  objectives_period_weekly: 'Weekly',
  objectives_period_monthly: 'Monthly',
  objectives_period_quarterly: 'Quarterly',
  objectives_period_yearly: 'Yearly',
  objectives_period_short_weekly: 'Week',
  objectives_period_short_monthly: 'Month',
  objectives_period_short_quarterly: 'Quarter',
  objectives_period_short_yearly: 'Year',
  objectives_reached_title: 'Objective reached',
  objectives_reached_member: 'reached the objective',
  objectives_reached_generic: 'The objective has been reached',
  objectives_target_required: 'Target value is required',
  objectives_completed: 'Completed',
  objectives_define_next: 'Define your next objective',

  // ─── Formulas ───
  formulas_title: 'Plans',
  formulas_add: 'Add plan',
  formulas_name: 'Name',
  formulas_price: 'Price',
  formulas_description: 'Description',
  formulas_commission: 'Commission',
  formulas_no_formulas: 'No plans',
  formulas_edit: 'Edit',
  formulas_delete: 'Delete',
  formulas_management: 'Sales Management',
  formulas_count: '{n} plan{s}',
  formulas_readonly: 'Organization pricing plans (read-only)',
  formulas_no_formulas_title: 'No plans',
  formulas_no_formulas_desc: 'Your manager has not created any plans yet.',
  formulas_active: 'Active',
  formulas_inactive: 'Inactive',
  formulas_on_quote: 'On quote',
  formulas_per_month: 'month',
  formulas_one_time: 'one-time',
  formulas_per_year: 'year',
  formulas_resources_count: '{n} Resource{s}',
  formulas_open: 'Open',
  formulas_no_resources: 'No resources',
  formulas_detail_title: 'Plan details',
  formulas_label_name: 'Name',
  formulas_label_price: 'Price',
  formulas_label_description: 'Description',
  formulas_new_formula: 'New Plan',
  formulas_create_formula: 'Create a plan',
  formulas_create_first_desc: 'Create your first pricing plan',
  formulas_edit_formula: 'Edit plan',
  formulas_name_required: 'Name is required',
  formulas_modified: 'Plan updated',
  formulas_created: 'Plan created',
  formulas_network_error: 'Network error',
  formulas_deactivated: 'Plan deactivated',
  formulas_activated: 'Plan activated',
  formulas_delete_confirm: 'Delete plan',
  formulas_deleted: 'Plan deleted',
  formulas_select_pdf: 'Please select a PDF file',
  formulas_upload_error: 'Upload error',
  formulas_pdf_uploaded: 'PDF uploaded',
  formulas_formula_name_label: 'Plan name *',
  formulas_formula_name_placeholder: 'E.g.: Premium Plan',
  formulas_price_label: 'Price (€)',
  formulas_billing_type_label: 'Billing type',
  formulas_billing_one_time: 'One-time payment',
  formulas_billing_subscription: 'Subscription',
  formulas_billing_quote: 'On quote',
  formulas_subscription_pricing: 'Subscription pricing',
  formulas_monthly_price_label: 'Monthly price (€) *',
  formulas_quarterly_price_label: 'Quarterly price (€)',
  formulas_quarterly_hint: 'Leave empty if no quarterly option',
  formulas_per_quarter: 'quarter',
  formulas_yearly_price_label: 'Yearly price (€)',
  formulas_yearly_hint: 'Leave empty if no yearly option',
  formulas_stripe_connected: 'Stripe connected',
  formulas_stripe_not_connected: 'Stripe not connected',
  formulas_stripe_connected_desc: 'Recurring payments will be automatically linked to prospects won with this plan.',
  formulas_stripe_not_connected_desc: 'Connect Stripe in Revenue to automatically link recurring payments.',
  formulas_description_label: 'Description',
  formulas_description_placeholder: 'Describe this plan...',
  formulas_team_assigned: 'Assigned team',
  formulas_all_team: 'All team',
  formulas_team_hint: 'Advanced commissions will only show members from this team.',
  formulas_resources_included: 'Included resources',
  formulas_add_resource: 'Add',
  formulas_no_resources_hint: 'No resources. Add PDF files, video links, content access...',
  formulas_no_resources_member: 'No resources',
  formulas_pdf_uploaded_link: 'PDF uploaded',
  formulas_change: 'Change',
  formulas_uploading: 'Uploading...',
  formulas_upload_pdf: 'Upload a PDF',
  formulas_commission_label: 'Commission',
  formulas_closing_label: 'Closing',
  formulas_setting_label: 'Setting',
  formulas_advanced: 'Advanced',
  formulas_customized: 'Custom',
  formulas_reset_role_rate: 'Reset to role rate',
  formulas_close_btn: 'Close',
  formulas_cancel_btn: 'Cancel',
  formulas_save_btn: 'Save',
  formulas_create_btn: 'Create',
  formulas_error: 'Error',

  // ─── Appointments ───
  appointments_title: 'Appointments',
  appointments_upcoming: 'Upcoming',
  appointments_past: 'Past',
  appointments_no_appointments: 'No appointments',
  appointments_with: 'With',
  appointments_at: 'at',
  appointments_status_confirmed: 'Confirmed',
  appointments_status_pending: 'Pending',
  appointments_status_cancelled: 'Cancelled',
  appointments_status_done: 'Done',
  appointments_status_no_show: 'No Show',
  appointments_add: 'Add appointment',
  appointments_reschedule: 'Reschedule',
  appointments_cancel: 'Cancel',

  // ─── Agenda ───
  agenda_title: 'Calendar',
  agenda_today: 'Today',
  agenda_week: 'Week',
  agenda_no_events: 'No events',

  // ─── Reminders ───
  reminders_title: 'Reminders',
  reminders_add: 'Add reminder',
  reminders_no_reminders: 'No reminders',
  reminders_due: 'Due',
  reminders_overdue: 'Overdue',
  reminders_completed: 'Completed',
  reminders_tomorrow: 'Tomorrow',
  reminders_yesterday: 'Yesterday',
  reminders_status_upcoming: 'Upcoming',
  reminders_status_overdue: 'Overdue',
  reminders_status_done: 'Done',
  reminders_created_toast: 'Reminder created',
  reminders_create_error: 'Unable to create reminder',
  reminders_page_title: 'Reminders',
  reminders_total_count: 'reminder',
  reminders_late_count: 'overdue',
  reminders_overdue_alert: 'Warning: You have critical reminders that have not been handled for over 24h.',
  reminders_view_urgent: 'View urgent',
  reminders_team_all: 'Team: All',
  reminders_reset_filters: 'Reset',
  reminders_new_reminder: 'New reminder',
  reminders_all_up_to_date: 'All up to date',
  reminders_no_reminders_desc: 'You have no reminders scheduled. Relax or create a new one.',
  reminders_add_reminder: 'Add a reminder',
  reminders_header_title: 'Title',
  reminders_header_description: 'Description',
  reminders_header_datetime: 'Date & time',
  reminders_header_assigned: 'Assigned',
  reminders_header_linked: 'Linked to',
  reminders_header_status: 'Status',
  reminders_header_actions: 'Actions',
  reminders_me: 'Me',
  reminders_myself: 'Myself',
  reminders_detail_title: 'Reminder detail',
  reminders_label_title: 'Title',
  reminders_label_description: 'Description',
  reminders_label_datetime: 'Date & Time',
  reminders_at_time: 'at',
  reminders_label_assigned_to: 'Assigned to',
  reminders_member: 'Member',
  reminders_label_linked_prospect: 'Linked prospect',
  reminders_view_card: 'View card →',
  reminders_label_created_at: 'Created on',
  reminders_mark_done: 'Mark as done',
  reminders_delete: 'Delete',
  reminders_modal_title: 'New reminder',
  reminders_modal_subtitle: 'Schedule a task or follow-up',
  reminders_form_title: 'Title *',
  reminders_form_title_placeholder: 'E.g.: Call back the prospect',
  reminders_form_description: 'Description',
  reminders_form_description_placeholder: 'Optional details...',
  reminders_form_date: 'Date *',
  reminders_form_time: 'Time *',
  reminders_form_assign_to: 'Assign to',
  reminders_form_myself_option: '— Myself —',
  reminders_form_link_to: 'Link to',
  reminders_form_link_none: 'None',
  reminders_form_link_prospect: 'A prospect',
  reminders_form_search_prospect: 'Search for a prospect...',
  reminders_form_no_prospect_found: 'No prospect found',
  reminders_form_linked_to: 'Linked to:',
  reminders_form_submit: 'Create reminder',

  // ─── Invoices ───
  invoices_title: 'Invoices',
  invoices_create: 'Create invoice',
  invoices_no_invoices: 'No invoices',
  invoices_amount: 'Amount',
  invoices_date: 'Date',
  invoices_status_paid: 'Paid',
  invoices_status_pending: 'Pending',
  invoices_status_overdue: 'Overdue',
  invoices_client: 'Client',
  invoices_download: 'Download',
  invoices_org_title: 'Organization invoices',

  // ─── Report ───
  report_title: 'Report',
  report_export_pdf: 'Export PDF',
  report_period: 'Period',
  report_summary: 'Summary',
  report_by_member: 'By member',
  report_by_offer: 'By offer',
  report_total_revenue: 'Total revenue',
  report_total_calls: 'Total calls',
  report_conversion_rate: 'Conversion rate',
  report_mmr_title: 'Monday Morning Reporting',
  report_7_days: '7 days',
  report_14_days: '14 days',
  report_30_days: '30 days',
  report_90_days: '90 days',
  report_6_months: '6 months',
  report_1_year: '1 year',
  report_all_time: 'All',
  report_subtitle: 'View the overall performance of your campaigns and sales team in real time.',
  report_export_pdf_btn: 'Export PDF',
  report_ca_generated: 'Revenue Generated',
  report_sales: 'Sales',
  report_avg_short: 'avg.',
  report_closing_rate: 'Closing Rate',
  report_closing_rate_high: 'High',
  report_closing_rate_normal: 'Normal',
  report_closing_rate_low: 'Low',
  report_estimated_commission: 'Estimated Commission',
  report_total_leads: 'Total Leads',
  report_show_up: 'Show Up',
  report_no_show: 'No Show',
  report_loss_rate: 'Loss Rate',
  report_you: 'You',
  report_member: 'Member',
  report_added_prospect: 'added a prospect',
  report_closed_sale: 'closed a sale',
  report_lost_deal: 'lost a deal',
  report_marked_noshow: 'marked a no-show',
  report_modified_pipeline: 'modified the pipeline',
  report_scheduled_appointment: 'scheduled an appointment',
  report_scheduled_reminder: 'scheduled a reminder',
  report_activity_feed_today: 'Activity Feed — Today',
  report_all_members: 'All members',
  report_me_owner: 'Me (Owner)',
  report_no_activity_today: 'No activity today',
  report_leads_by_stage: 'Lead Distribution by Stage',
  report_no_data: 'No data',
  report_ca_by_campaign: 'Revenue by Campaign',
  report_loss_reasons: 'Loss Reasons',
  report_autre_detail_title: '"Other" Reason Details',
  report_result: 'result',
  report_results: 'results',
  report_all_campaigns: 'All campaigns',
  report_all_closers: 'All closers',
  report_all_teams: 'All teams',
  report_no_autre_found: 'No "Other" reasons found',
  report_try_modify_filters: 'Try modifying the filters',
  report_reason: 'Reason',
  report_prospect: 'Prospect',
  report_closer: 'Closer',
  report_campaign_performance: 'Campaign Performance',
  report_no_campaign: 'No campaigns',
  report_campaign: 'Campaign',
  report_status: 'Status',
  report_date: 'Date',
  report_views: 'Views',
  report_conv: 'Conv.',
  report_ca: 'Revenue',
  report_commission: 'Commission',
  report_active: 'Active',
  report_paused: 'Paused',
  report_total: 'Total',
  report_team_performance: 'Team Performance',
  report_no_team_member: 'No team members',
  report_wins: 'Wins',
  report_financial_summary: 'Financial Summary',
  report_avg_deal: 'Average Deal',
  report_show_up_rate: 'Show Up Rate',
  report_appointments: 'Appointments',
  report_total_short: 'total',
  report_done: 'done',
  report_done_plural: 'done',
  report_total_rdv: 'Total Appts',
  report_completed: 'Completed',
  report_pending: 'Pending',
  report_confirmed: 'Confirmed',
  report_cancelled: 'Cancelled',
  report_show_up_rate_label: 'Show Up Rate',
  report_detailed_pipeline: 'Detailed Pipeline',
  report_total_value: 'Total value:',
  report_prospects: 'Prospects',
  report_won: 'Won',
  report_stage_new_lead: 'New Lead',
  report_stage_qualified: 'Qualified',
  report_stage_unqualified: 'Unqualified',
  report_stage_followup: 'Follow Up',
  report_stage_won: 'Won',
  report_stage_lost: 'Lost',
  report_stage_no_answer: 'No Answer',
  report_stage_no_show: 'No Show',
  report_pdf_title: 'CloseOS Business — Report',
  report_pdf_period: 'Period:',
  report_pdf_generated_on: 'Generated on',
  report_pdf_closing: 'Closing',
  report_pdf_pipeline_distribution: 'Pipeline Distribution',
  report_pdf_campaign_performance: 'Campaign Performance',
  report_pdf_registered: 'Registered',
  report_pdf_inactive: 'Inactive',
  report_pdf_team: 'Team',
  report_pdf_members: 'members',
  report_pdf_member_col: 'Member',
  report_pdf_role: 'Role',
  report_pdf_email: 'Email',
  report_pdf_since: 'Since',
  report_pdf_appointments: 'Appointments',
  report_pdf_total: 'Total:',
  report_pdf_done: 'Completed:',
  report_pdf_cancelled: 'Cancelled:',
  report_pdf_show_up: 'Show Up:',
  report_pdf_footer: 'CloseOS Business · Auto-generated report',
  report_not_specified: 'Not specified',
  report_not_assigned: 'Unassigned',

  // ─── KPI ───
  kpi_title: 'KPI',
  kpi_setter_title: 'Setter KPI',
  kpi_closer_title: 'Closer KPI',
  kpi_calls_made: 'Calls made',
  kpi_calls_answered: 'Calls answered',
  kpi_conversion: 'Conversion',
  kpi_revenue: 'Revenue',
  kpi_avg_call_duration: 'Avg. call duration',
  kpi_appointments_set: 'Appointments set',
  kpi_no_show_rate: 'No-show rate',
  kpi_by_offer: 'By offer',
  kpi_evolution: 'Trend',
  kpi_period: 'Period',
  kpi_ca_generated: 'Revenue Generated',
  kpi_total_sales: 'Total Sales',
  kpi_conversion_rate: 'Conversion Rate',
  kpi_active_prospects: 'Active Prospects',
  kpi_noshow_rate: 'No Show Rate',
  kpi_deals_lost: 'Deals Lost',
  kpi_followup_rate: 'Follow-up Rate',
  kpi_r2_closing_rate: 'Closing after R2',
  kpi_total_leads: 'Total Leads',
  kpi_deals_in_progress: 'Deals in Progress',
  kpi_avg_value: 'Average Value',
  kpi_closing_rate_history: 'Closing Rate History',
  kpi_ca_history: 'Monthly Revenue History',
  kpi_loss_reasons: 'Loss Reasons',
  kpi_closing_rate_tooltip: 'Closing rate',
  kpi_ca_tooltip: 'Revenue',
  kpi_tab_global: 'Global',
  kpi_tab_period: 'By Period',
  kpi_tab_member: 'By Member',
  kpi_tab_team: 'By Team',
  kpi_all_members: 'All members',
  kpi_performance_by_member: 'Performance by Member',
  kpi_click_member_detail: 'Click on a member to see their detailed KPIs.',
  kpi_header_name: 'Name',
  kpi_header_role: 'Role',
  kpi_header_prospects: 'Prospects',
  kpi_header_sales: 'Sales',
  kpi_header_ca: 'Revenue',
  kpi_header_conv_rate: 'Conv. Rate',
  kpi_you_owner: 'You (Owner)',
  kpi_no_team_members: 'No team members. Invite members from the Team page.',
  kpi_back_to_list: 'Back to list',
  kpi_commission_10: 'Commission (10%)',
  kpi_commission_history: 'Commission History',
  kpi_no_data_yet: 'No data yet',
  kpi_avg_commission: 'Avg. Commission',
  kpi_stage_distribution: 'Stage Distribution',
  kpi_loss_reasons_period: 'Loss Reasons',
  kpi_stage_followup: 'Follow-up',
  kpi_stage_noshow: 'No Show',
  kpi_stage_unqualified: 'Unqualified',
  kpi_stage_noanswer: 'No Answer',
  kpi_team_members_count: 'member',
  kpi_no_members_in_team: 'No members in this team',
  kpi_performance_setter: 'Setter Performance',
  kpi_performance_closer: 'Closer Performance',
  kpi_team_overview: 'Overview',
  kpi_your_performance: 'Your performance',
  kpi_configure: 'Configure',
  kpi_export_pdf: 'Export PDF',
  kpi_period_label: 'Period',
  kpi_reset: 'Reset',
  kpi_all_periods: 'All periods',
  kpi_tab_org: 'Organization',
  kpi_tab_by_formula: 'By Plan',
  kpi_tab_by_campaign: 'By Campaign',
  kpi_tab_by_source: 'By Source',
  kpi_tab_personal: 'Personal',
  kpi_no_formula: 'No plans',
  kpi_no_campaign: 'No campaigns',
  kpi_no_source: 'No sources',
  kpi_response_rate: 'Response rate',
  kpi_booking_rate: 'Booking rate',
  kpi_responses_contacted: 'Responses / Contacted',
  kpi_booked_contacted: 'Booked / Contacted',
  kpi_closing_rate: 'Closing rate',
  kpi_won_qualified: 'Won / Qualified',
  kpi_noshow_qualified: 'No-show / Qualified',
  kpi_my_commissions: 'My commissions',
  kpi_commissions: 'Commissions',
  kpi_closing_rate_chart: 'Closing rate',
  kpi_commission_chart: 'Commissions',
  kpi_pipeline_summary: 'Pipeline',
  kpi_avg_comm: 'Avg. Commission',
  kpi_config_title: 'KPI Configuration',
  kpi_revenue_target: 'Revenue target',
  kpi_planned_calls: 'Planned calls',
  kpi_commission_rate: 'Commission rate',
  kpi_save_error: 'Error saving',
  kpi_config_saved: 'Configuration saved',
  kpi_pdf_exported: 'PDF exported',
  kpi_pdf_export_error: 'Error exporting PDF',
  kpi_exported_on: 'Exported on',
  kpi_org_kpis: 'Organization KPIs',
  kpi_autre_details_title: '"Other" Details',
  kpi_autre_results: 'results',
  kpi_all_closers: 'All closers',
  kpi_all_teams: 'All teams',
  kpi_autre_header_motif: 'Reason',
  kpi_autre_header_prospect: 'Prospect',
  kpi_autre_header_closer: 'Closer',
  kpi_autre_header_date: 'Date',
  kpi_no_autre_found: 'No "Other" results found',
  kpi_try_change_filters: 'Try changing filters',
  kpi_not_specified: 'Not specified',
  kpi_not_assigned: 'Not assigned',
  kpi_by_formula_label: 'By Plan',
  kpi_by_campaign_label: 'By Campaign',
  kpi_by_source_label: 'By Source',
  kpi_month_jan: 'January',
  kpi_month_feb: 'February',
  kpi_month_mar: 'March',
  kpi_month_apr: 'April',
  kpi_month_may: 'May',
  kpi_month_jun: 'June',
  kpi_month_jul: 'July',
  kpi_month_aug: 'August',
  kpi_month_sep: 'September',
  kpi_month_oct: 'October',
  kpi_month_nov: 'November',
  kpi_month_dec: 'December',
  kpi_tab_by_team: 'By Team',
  kpi_stage_distribution_period: 'Stage Distribution',
  kpi_bar_prospects: 'Prospects',

  // ─── Revenue ───
  revenue_title: 'Revenue',
  revenue_total: 'Total',
  revenue_monthly: 'This month',
  revenue_by_member: 'By member',
  revenue_by_offer: 'By offer',
  revenue_chart: 'Chart',
  revenue_stripe_connect: 'Connect Stripe',
  revenue_payments: 'Payments',
  revenue_period_this_month: 'This month',
  revenue_period_3m: '3 months',
  revenue_period_6m: '6 months',
  revenue_period_this_year: 'This year',
  revenue_period_all: 'All',
  revenue_tab_revenue: 'Revenue',
  revenue_tab_charges: 'Charges',
  revenue_tab_margin: 'Margin',
  revenue_connect_stripe_title: 'Connect Stripe',
  revenue_connect_stripe_desc: 'Sync your Stripe subscriptions and payments for automatic tracking.',
  revenue_connect_btn: 'Connect Stripe',
  revenue_stripe_syncing: 'Syncing...',
  revenue_resync_stripe: 'Re-sync Stripe',
  revenue_disconnect_stripe: 'Disconnect Stripe',
  revenue_disconnect_confirm: 'Are you sure you want to disconnect Stripe?',
  revenue_stripe_disconnected: 'Stripe disconnected',
  revenue_stripe_disconnect_error: 'Error disconnecting',
  revenue_stripe_connected_success: 'Stripe connected successfully',
  revenue_load_error: 'Error loading revenue',
  revenue_charge_added: 'Charge added',
  revenue_ca_label: 'Revenue',
  revenue_net_margin: 'Net Margin',
  revenue_new_clients: 'New clients',
  revenue_cancellations: 'Cancellations',
  revenue_churn: 'Churn',
  revenue_active_subscriptions: 'Active subscriptions',
  revenue_no_active_sub: 'No active subscriptions',
  revenue_connect_stripe_to_see: 'Connect Stripe to see your subscriptions',
  revenue_sub_active: 'Active',
  revenue_sub_trial: 'Trial',
  revenue_per_month: 'month',
  revenue_per_year: 'year',
  revenue_team_commissions: 'Team commissions',
  revenue_no_commission: 'No commissions this month',
  revenue_fixed_salary: 'Fixed salary',
  revenue_commission_label: 'Commission',
  revenue_fixed_charges: 'Fixed charges',
  revenue_variable_charges: 'Variable charges',
  revenue_no_fixed_charge: 'No fixed charges',
  revenue_no_variable_charge: 'No variable charges',
  revenue_label_placeholder: 'Label',
  revenue_amount_placeholder: 'Amount',
  revenue_monthly_evolution: 'Monthly evolution',
  revenue_commissions_breakdown: 'Commissions breakdown',
  revenue_stripe_benefit_1: 'Automatic subscription sync',
  revenue_stripe_benefit_2: 'Real-time MRR and churn tracking',
  revenue_stripe_benefit_3: 'Complete payment history',
  revenue_stripe_connected_desc: 'Your Stripe account is connected. Data is synced automatically.',
  revenue_sync_created: '{created} subscriptions created, {matched} matched',
  revenue_error: 'An error occurred',
  revenue_month_jan: 'Jan',
  revenue_month_feb: 'Feb',
  revenue_month_mar: 'Mar',
  revenue_month_apr: 'Apr',
  revenue_month_may: 'May',
  revenue_month_jun: 'Jun',
  revenue_month_jul: 'Jul',
  revenue_month_aug: 'Aug',
  revenue_month_sep: 'Sep',
  revenue_month_oct: 'Oct',
  revenue_month_nov: 'Nov',
  revenue_month_dec: 'Dec',

  // ─── Call Room ───
  callroom_title: 'Call cockpit',
  callroom_script: 'Script',
  callroom_notes: 'Notes',
  callroom_offer: 'Offer',
  callroom_resources: 'Resources',
  callroom_start_call: 'Start call',
  callroom_end_call: 'End call',
  callroom_recording: 'Recording',
  callroom_prospect_info: 'Prospect info',
  callroom_save_notes: 'Save notes',
  callroom_result: 'Call result',
  callroom_result_sold: 'Sold',
  callroom_result_not_sold: 'Not sold',
  callroom_result_callback: 'Callback',
  callroom_result_no_show: 'No Show',
  callroom_result_cancelled: 'Cancelled',

  // ─── Call Details ───
  calldetails_title: 'Call details',
  calldetails_duration: 'Duration',
  calldetails_recording: 'Recording',
  calldetails_notes: 'Notes',
  calldetails_result: 'Result',
  calldetails_prospect: 'Prospect',
  calldetails_date: 'Date',
  calldetails_offer: 'Offer',

  // ─── Availability ───
  availability_title: 'Availability',
  availability_add_slot: 'Add slot',
  availability_no_slots: 'No slots',
  availability_absences: 'Absences',
  availability_add_absence: 'Add absence',
  availability_from: 'From',
  availability_to: 'To',
  availability_reason: 'Reason',
  availability_subtitle: 'Manage your slots and absences to optimize your sales funnel.',
  availability_weekly_slots: 'Weekly slots',
  availability_unavailable: 'Unavailable',
  availability_add_slot_btn: 'Add a slot',
  availability_add_short: 'Add',
  availability_cancel: 'Cancel',
  availability_copy_to: 'Copy to {n} day{s}',
  availability_weekend: 'Weekend',
  availability_absences_title: 'Absences',
  availability_no_absences: 'No absences scheduled',
  availability_start_date: 'Start date',
  availability_end_date: 'End date',
  availability_reason_optional: 'Reason (optional)',
  availability_reason_placeholder: 'E.g.: Vacation, Training...',
  availability_confirm: 'Confirm',
  availability_new_absence: 'New absence',
  availability_booking_settings: 'Booking settings',
  availability_booking_rules_desc: 'These rules apply to your booking links',
  availability_max_per_day: 'Max appointments per day',
  availability_unlimited: 'Unlimited',
  availability_per_day: '{n} appointments / day',
  availability_buffer_before: 'Buffer before an appointment',
  availability_buffer_desc: 'Prevents bookings too close to another appointment',
  availability_no_buffer: 'No buffer',
  availability_minutes: '{n} minutes',
  availability_hour: '{n} hour',
  availability_min_notice: 'Minimum booking notice',
  availability_min_notice_desc: 'Cannot book a slot before this delay',
  availability_no_delay: 'No delay',
  availability_hours_before: '{n} hour{s} before',
  availability_save_settings: 'Save',
  availability_settings_saved: 'Settings saved',
  availability_slot_added: 'Slot added',
  availability_slot_deleted: 'Slot deleted',
  availability_absence_added: 'Absence added',
  availability_slots_copied: 'Slots copied to {names}',
  availability_onboarding_title: 'Set up your availability',
  availability_onboarding_desc: 'Before getting started, set your weekly availability slots. This will allow your manager to assign appointments at the right times.',
  availability_onboarding_step1: '1. Add your slots for each day',
  availability_onboarding_step2: '2. Indicate your absence periods if needed',
  availability_onboarding_step3: '3. Update this information at any time',
  availability_onboarding_go: 'Let\'s go!',
  availability_to_time: 'to',

  // ─── Organization ───
  org_title: 'Organization',
  org_company_name: 'Company name',
  org_logo: 'Logo',
  org_description: 'Description',
  org_website: 'Website',
  org_address: 'Address',
  org_phone: 'Phone',
  org_email: 'Email',
  org_billing_info: 'Billing information',
  org_raison_sociale: 'Legal name',
  org_subscription: 'Subscription',
  org_plan: 'Plan',
  org_manage_subscription: 'Manage subscription',

  // ─── Onboarding ───
  onboarding_welcome: 'Welcome to CloseOS Business!',
  onboarding_step: 'Step',
  onboarding_company_name: 'Your company name',
  onboarding_team_size: 'Your team size',
  onboarding_niche: 'Your niche',
  onboarding_finish: 'Finish',
  onboarding_skip: 'Skip',
  onboarding_tm_welcome: 'Welcome to {company}!',
  onboarding_tm_welcome_fallback: 'your organization',
  onboarding_tm_subtitle: 'Complete your profile to get started',
  onboarding_tm_first_name: 'First name',
  onboarding_tm_last_name: 'Last name',
  onboarding_tm_dob: 'Date of birth',
  onboarding_tm_phone: 'Phone',
  onboarding_tm_years_old: '{age} years old',
  onboarding_tm_finish: 'Finish',
  onboarding_tm_cancel_crop: 'Cancel',
  onboarding_tm_validate_photo: 'Validate photo',
  onboarding_owner_profile_title: 'Your profile',
  onboarding_owner_profile_subtitle: 'Introduce yourself in a few seconds',
  onboarding_owner_full_name: 'Full name',
  onboarding_owner_phone: 'Phone',
  onboarding_owner_role: 'Your role',
  onboarding_owner_continue: 'Continue',
  onboarding_owner_company_title: 'Your company',
  onboarding_owner_company_subtitle: 'Set up your Business space',
  onboarding_owner_company_name: 'Company name',
  onboarding_owner_company_placeholder: 'My company',
  onboarding_owner_team_size: 'Team size',
  onboarding_owner_niche_sector: 'Niche / Sector',
  onboarding_owner_niche_custom_placeholder: 'Specify your sector...',
  onboarding_owner_back: 'Back',
  onboarding_owner_cancel_crop: 'Cancel',
  onboarding_owner_validate_photo: 'Validate photo',

  // ─── Login ───
  login_title: 'Sign in',
  login_email: 'Email',
  login_password: 'Password',
  login_submit: 'Sign in',
  login_google: 'Continue with Google',
  login_no_account: 'Don\'t have an account?',
  login_register: 'Sign up',
  login_forgot: 'Forgot password?',
  login_subtitle: 'Manage your campaigns and assets with CloseOS Business.',
  login_email_placeholder: 'Username or email',
  login_or_continue: 'Or continue with',
  login_create_account: 'Create an account',
  login_help: 'Help',
  login_privacy: 'Privacy',
  login_terms: 'Terms',
  login_all_rights: 'All rights reserved.',
  login_code_title: 'Login with code',
  login_code_subtitle: 'Enter your email to receive a login code.',
  login_code_send: 'Send code',
  login_code_back: 'Back',
  login_code_enter_title: 'Enter the code',
  login_code_enter_subtitle: 'A 6-digit code was sent to',
  login_code_resend: 'Resend code',
  login_code_resend_countdown: 'Resend ({seconds}s)',
  login_code_change_email: 'Change email',
  login_code_sent: 'Code sent to {email}',
  login_code_new_sent: 'New code sent!',
  login_code_resend_error: 'Error resending code.',
  login_code_invalid: 'Invalid code',
  login_code_send_error: 'Error sending code',
  login_code_connection_error: 'Connection error. Please try again.',
  login_error_generic: 'An error occurred.',
  login_error_google: 'Unable to start Google sign-in.',
  login_error_credentials: 'Invalid email or password',
  login_email_label: 'Email Address',
  login_your_email: 'Your email',
  register_title: 'Start your expansion',
  register_subtitle: 'Create an account and manage your closer team',
  register_google: 'Sign up with Google',
  register_or_continue: 'Or continue with',
  register_name: 'Full name',
  register_submit: 'Create my Business account',
  register_has_account: 'Already have an account?',
  register_login: 'Sign in',
  register_terms_text: 'By creating an account, you agree to our',
  register_cgu: 'Terms',
  register_and: 'and our',
  register_privacy_policy: 'Privacy Policy',
  register_all_rights: 'All rights reserved.',
  register_error_sales_email: 'This email is already linked to a CloseOS Sales account. Please use another email.',
  register_error_generic: 'An error occurred.',
  register_error_google: 'Unable to start Google sign-in.',
  verification_title: 'Security verification',
  verification_subtitle: 'A verification code was sent to your email',
  verification_verify: 'Verify',
  verification_verifying: 'Verifying...',
  verification_resend: 'Resend code',
  verification_resend_countdown: 'Resend ({seconds}s)',
  verification_code_sent: 'Code sent!',
  verification_cancel: 'Cancel',
  invitation_invalid_link: 'Invalid invitation link.',
  invitation_expired: 'Invitation invalid or expired.',
  invitation_validate_error: 'Unable to validate invitation.',
  invitation_join_team: 'Join the team',
  invitation_as_role: 'as',
  invitation_first_name: 'First name',
  invitation_last_name: 'Last name',
  invitation_submit: 'Join',
  invitation_google: 'Continue with Google',
  invitation_or_continue: 'Or',
  invitation_success_title: 'Welcome to the team!',
  invitation_success_subtitle: 'Your account has been created successfully.',
  invitation_go_dashboard: 'Go to dashboard',
  invitation_accept_error: 'Error accepting invitation.',
  invitation_email_sales_conflict: 'This email is already linked to a CloseOS Sales account. Please use a different email.',
  invitation_account_sales_conflict: 'This account is already linked to a CloseOS Sales account. Please sign out and use a different email.',
  invitation_account_creation_error: 'Error creating account.',
  invitation_generic_error: 'An error occurred.',
  invitation_google_error: 'Unable to start Google sign-in.',
  invitation_google_sales_conflict: 'This Google account is already linked to a CloseOS Sales account. Please use a different account.',
  invitation_accept_error_short: 'Error accepting invitation.',
  invitation_invalid_title: 'Invalid invitation',
  invitation_create_business: 'Create a Business account',
  invitation_welcome_title: 'Welcome to the team!',
  invitation_welcome_joined: 'You have joined',
  invitation_welcome_as: 'as',
  invitation_redirecting: 'Redirecting to dashboard...',
  invitation_join_company: 'Join',
  invitation_leader: 'Leader',
  invitation_website: 'Website',
  invitation_address: 'Address',
  invitation_secure_access: 'Secure access',
  invitation_invited_by: 'Invited by',
  invitation_or_email: 'Or with email',
  invitation_email_label: 'Email address',
  invitation_password_label: 'Password',
  invitation_accept_btn: 'Accept invitation',
  invitation_terms_prefix: 'By continuing, you agree to our',
  invitation_terms_link: 'Terms of Service',
  invitation_terms_and: 'and our',
  invitation_privacy_link: 'Privacy Policy',
  invitation_already_account: 'Already have an account?',
  invitation_login: 'Sign in',
  invitation_default_manager: 'A manager',
  invitation_default_company: 'an organization',
  invitation_default_role: 'Member',
  // ─── Closer Dashboard ───
  closer_dashboard_activity_status: 'Here is the state of your activity today.',
  closer_dashboard_view_kpis: 'View my KPIs',
  closer_dashboard_tooltip_commission: 'Total commission calculated on your signed sales. Includes closer and setter commissions if applicable.',
  closer_dashboard_tooltip_ca: 'Total revenue generated by your won prospects (Won stage). Sum of each signed prospect value.',
  closer_dashboard_commission: 'Commission',
  closer_dashboard_ca_generated: 'Revenue',
  closer_dashboard_tooltip_closing: 'Closing rate: percentage of prospects converted into sales. Calculated: won / (won + lost + no-shows with appointments).',
  closer_dashboard_closing: 'Closing',
  closer_dashboard_signed_decided: 'signed / {decided} decided',
  closer_dashboard_tooltip_booking: 'Booking rate: percentage of contacted prospects who were booked (moved past prospect stage). Calculated: booked / total assigned prospects as setter.',
  closer_dashboard_booking: 'Booking',
  closer_dashboard_booked_prospects: 'booked / {total} prospects',
  closer_dashboard_tooltip_appointments: 'Total number of upcoming scheduled appointments (confirmed and pending) from today.',
  closer_dashboard_appointments_label: 'Appointments',
  closer_dashboard_upcoming: 'Upcoming',
  closer_dashboard_tooltip_noshow: 'No-show rate: percentage of prospects absent from appointments. Calculated: no-shows / total qualified prospects with appointments (excludes prospect, unqualified, no answer).',
  closer_dashboard_noshow: 'No-Show',
  closer_dashboard_upcoming_appointments: 'Upcoming appointments',
  closer_dashboard_upcoming_desc: 'Your next scheduled consultations.',
  closer_dashboard_view_all: 'View all',
  closer_dashboard_no_appointments: 'No upcoming appointments',
  closer_dashboard_appointment_fallback: 'Appointment',
  closer_dashboard_reminders: 'Reminders',
  closer_dashboard_no_reminders: 'No pending reminders',
  closer_dashboard_overdue: 'OVERDUE',
  closer_dashboard_upcoming_tag: 'UPCOMING',
  closer_dashboard_overdue_prefix: 'Overdue: ',
  closer_dashboard_mark_done_title: 'Mark as done',
  closer_dashboard_create_reminder: '+ Create a reminder',
  closer_dashboard_member_fallback: 'Member',
  dashboard_appt_today: 'TODAY',
  dashboard_appt_tomorrow: 'TMR.',
  dashboard_reminder_done: 'Reminder marked as done!',
  return_payment_success: 'Payment successful!',
  return_create_account: 'Create your account to access CloseOS Business.',
  return_name: 'Full name',
  return_submit: 'Create my account',
  return_creating: 'Creating account...',
  return_processing: 'Processing...',

  // ─── Prospect View ───
  prospect_info: 'Information',
  prospect_history: 'History',
  prospect_calls: 'Calls',
  prospect_appointments: 'Appointments',
  prospect_notes: 'Notes',
  prospect_add_note: 'Add note',
  prospect_edit: 'Edit',
  prospect_delete: 'Delete',
  prospect_source: 'Source',
  prospect_formula: 'Plan',
  prospect_assigned: 'Assigned to',
  prospect_created: 'Created',
  prospect_amount: 'Amount',
  prospect_contact: 'Contact',
  prospect_no_name: 'No name',
  prospect_open_callroom: 'Open Call Room',
  prospect_create_reminder: 'Create a reminder',
  prospect_tab_info: 'Information',
  prospect_tab_call_notes: 'Call Notes',
  prospect_tab_reminders: 'Reminders',
  prospect_tab_history: 'History',
  prospect_current_stage: 'Current stage',
  prospect_loss_reason_title: 'Loss reason',
  prospect_loss_reason_label: 'Reason',
  prospect_loss_reason_select: 'Select a reason',
  prospect_loss_details: 'Details',
  prospect_loss_details_placeholder: 'Specify the details...',
  prospect_payment_title: 'Payment Details',
  prospect_payment_final_amount: 'Final amount (EUR)',
  prospect_payment_sale_amount: 'Sale Amount',
  prospect_payment_cash: 'Cash',
  prospect_payment_installments: 'Installments',
  prospect_payment_nb_installments: 'Number of installments',
  prospect_payment_commission: 'Your Commission ({rate}%)',
  prospect_payment_you_receive: 'You will receive: {amount} / month',
  prospect_payment_validate: 'Validate details',
  prospect_payment_total_commission: 'Total Commission ({rate}%)',
  prospect_payment_client_pays: 'Client pays (x{count}):',
  prospect_payment_you_get: 'You receive:',
  prospect_payment_times_per_month: '{n} times ({amount}/mo)',
  prospect_payment_monthly: '/ month',
  prospect_payment_label_cash: 'Cash Payment',
  prospect_payment_label_installments: 'Payment in {count} installments',
  prospect_stripe_subscription: 'Stripe Subscription',
  prospect_stripe_status: 'Status',
  prospect_stripe_active: 'Active',
  prospect_stripe_past_due: 'Past Due',
  prospect_stripe_canceled: 'Canceled',
  prospect_stripe_trialing: 'Trialing',
  prospect_stripe_amount_label: 'Amount',
  prospect_stripe_month: 'month',
  prospect_stripe_year: 'year',
  prospect_stripe_last_payment: 'Last payment',
  prospect_stripe_next_payment: 'Next payment',
  prospect_stripe_linked_webhook: 'Linked automatically (webhook)',
  prospect_stripe_linked_auto: 'Linked automatically',
  prospect_stripe_linked_manual: 'Linked manually',
  prospect_stripe_link_btn: 'Link a Stripe subscription',
  prospect_stripe_link_title: 'Link to Stripe',
  prospect_stripe_auto_search: 'Automatic search via email',
  prospect_stripe_not_found: 'No subscription found. Try Search or Manual.',
  prospect_stripe_search_btn: 'Search',
  prospect_stripe_search_placeholder: 'Stripe customer email',
  prospect_stripe_no_customer: 'No customer found.',
  prospect_stripe_no_sub: 'No subscription',
  prospect_stripe_link_manual_btn: 'Link this subscription',
  prospect_stripe_linked_success: 'Stripe subscription linked successfully',
  prospect_assign_closer: 'Assign a Closer',
  prospect_assign_setter: 'Assign a Setter',
  prospect_assign_none: 'None',
  prospect_campaign_origin: 'Origin campaign',
  prospect_offer_formula: 'Offer / Plan',
  prospect_no_offer: 'No offer',
  prospect_capture_responses: 'Capture responses',
  prospect_qualification: 'Qualification',
  prospect_answers: 'Answers',
  prospect_global_score: 'Overall score',
  prospect_eliminatory: 'Eliminatory: {count}/{max}',
  prospect_disqualified: 'Disqualified',
  prospect_client_card: 'Client Card',
  prospect_phone: 'Phone',
  prospect_creation_date: 'Creation date',
  prospect_next_appointment: 'Next appointment',
  prospect_internal_notes: 'Internal Notes',
  prospect_notes_placeholder: 'Add a comment about the prospect profile...',
  prospect_save_btn: 'Save',
  prospect_cancel_btn: 'Cancel',
  prospect_no_notes: 'No notes',
  prospect_capture_data_ref: '(Capture data - see section above)',
  prospect_add_manual_note: 'Add a manual note',
  prospect_new_note: 'New Note',
  prospect_note_placeholder: 'Write your call note here...',
  prospect_no_call_notes: 'No call notes',
  prospect_manual_notes_hint: 'Your manual notes will appear here.',
  prospect_add_reminder: 'Add a reminder',
  prospect_no_reminders: 'No reminders',
  prospect_create_reminder_hint: 'Create a reminder for this prospect.',
  prospect_reminder_done: 'Done',
  prospect_reminder_overdue: 'Overdue',
  prospect_new_reminder: 'New reminder',
  prospect_reminder_title: 'Title *',
  prospect_reminder_title_placeholder: 'E.g.: Call back the prospect',
  prospect_reminder_description: 'Description',
  prospect_reminder_desc_placeholder: 'Optional details...',
  prospect_reminder_date: 'Date *',
  prospect_reminder_time: 'Time *',
  prospect_reminder_linked: 'Linked to:',
  prospect_reminder_this_prospect: 'This prospect',
  prospect_reminder_create_btn: 'Create reminder',
  prospect_no_history: 'No history recorded',
  prospect_history_changes_hint: 'Changes will appear here.',
  prospect_history_by: 'By:',
  prospect_history_created: 'Prospect created',
  prospect_history_stage_arrow: 'Stage → {stage}',
  prospect_history_step_change: 'Stage change',
  prospect_history_stripe_renewal: 'Stripe Renewal',
  prospect_history_stripe_linked: 'Stripe Subscription linked',
  prospect_history_field_modified: '{field} modified',
  prospect_history_fields_modified: '{count} fields modified',
  prospect_footer_delete: 'Delete',
  prospect_footer_add_pipeline: 'Add to pipeline',
  prospect_footer_remove_pipeline: 'Remove from pipeline',
  prospect_footer_save: 'Save',
  prospect_toast_photo_updated: 'Photo updated',
  prospect_toast_upload_error: 'Error during upload',
  prospect_toast_file_required: 'Image file required',
  prospect_toast_file_too_large: 'Image too large (max 5 MB)',
  prospect_toast_stripe_auto: 'Stripe subscription linked automatically',
  prospect_toast_stripe_linked: 'Stripe subscription linked',
  prospect_toast_stripe_manual: 'Stripe subscription linked manually',
  prospect_toast_stripe_error: 'Unable to link subscription',
  prospect_toast_stripe_link_error: 'Stripe linking error',
  prospect_toast_stripe_success: 'Stripe subscription linked successfully',
  prospect_toast_reminder_created: 'Reminder created',
  prospect_toast_reminder_error: 'Unable to create reminder',
  prospect_toast_email_missing: 'Email missing',
  prospect_toast_phone_missing: 'Phone missing',
  prospect_toast_added_pipeline: 'Prospect added to pipeline',
  prospect_toast_removed_pipeline: 'Prospect removed from pipeline',
  prospect_toast_error: 'Error',
  prospect_confirm_delete_note: 'Delete this note?',
  prospect_confirm_delete: 'Delete {name}?',
  prospect_no_tags: 'No tags available',
  prospect_change_photo: 'Change photo',
  prospect_history_empty: '(empty)',
  prospect_history_yes: 'Yes',
  prospect_history_no: 'No',
  prospect_history_cash: 'Cash',
  prospect_history_installments_label: 'Installments',
  prospect_history_photo_updated: 'Photo updated',
  prospect_history_none_formula: '(none)',
  prospect_field_firstname: 'First name',
  prospect_field_lastname: 'Last name',
  prospect_field_contact: 'Contact',
  prospect_field_email: 'Email',
  prospect_field_phone_label: 'Phone',
  prospect_field_company: 'Company',
  prospect_field_title: 'Title',
  prospect_field_stage: 'Stage',
  prospect_field_value: 'Amount',
  prospect_field_offer: 'Offer',
  prospect_field_offer_id: 'Offer ID',
  prospect_field_formula_id: 'Plan',
  prospect_field_assigned_closer: 'Assigned closer',
  prospect_field_assigned_setter: 'Assigned setter',
  prospect_field_payment_type: 'Payment type',
  prospect_field_installments: 'Installments',
  prospect_field_probability: 'Probability',
  prospect_field_notes_label: 'Notes',
  prospect_field_avatar: 'Profile photo',
  prospect_field_pipeline_visible: 'Pipeline visible',
  prospect_field_loss_reason: 'Loss reason',
  prospect_field_loss_details: 'Loss details',
  prospect_field_stripe_sub: 'Stripe Subscription',
  prospect_field_sub_status: 'Subscription status',
  prospect_system_author: 'System',
  prospect_manual_author: 'Manual',
  prospect_search_label: 'Search',
  prospect_manual_label: 'Manual',
  prospect_eliminatory_label: 'Eliminatory',
  prospect_sauvegarder: 'Save',

  // ─── Invite Modal ───
  invite_title: 'Invite member',
  invite_desc: 'Generate an invitation link to add a member to your team.',
  invite_role_label: 'New member role',
  invite_generate: 'Generate link',
  invite_link_ready: 'Link ready!',
  invite_copy: 'Copy link',
  invite_expires: 'Expires in 7 days',
  invite_admin_full_access: 'Full access',
  invite_admin_same_rights: 'An Admin has the exact same rights as the Owner on the entire platform.',
  invite_hos_campaign_mgmt: 'Campaign management',
  invite_hos_campaign_desc: 'Give access to the Campaigns page',
  invite_setter_mode: 'Setting mode',
  invite_setter_self: 'Set for themselves',
  invite_setter_all: 'Set for everyone',
  invite_setter_self_desc: 'Can only book for themselves and cannot assign prospects to other closers.',
  invite_setter_all_desc: 'Can book appointments for other members and assign prospects to closers.',
  invite_link_generated: 'Invitation link generated!',
  invite_send_by_email: 'Send by email',
  invite_email_sent: 'Invitation sent to {email}',
  invite_email_placeholder: 'email@example.com',
  invite_email_error: 'Unable to send the email',
  invite_close: 'Close',
  invite_fallback_name: 'Your manager',

  // ─── Paywall ───
  paywall_title: 'Premium feature',
  paywall_desc: 'This feature is reserved for higher plans.',
  paywall_upgrade: 'Upgrade your plan',
  paywall_feature_locked: 'Feature locked',
  paywall_trial_ended: 'Your free trial has ended',
  paywall_trial_ended_desc: 'Your free trial has expired. Choose a plan to continue using CloseOS Business.',
  paywall_choose_plan: 'Choose a plan',
  paywall_contact_question: 'Have a question?',
  block_access_blocked: 'Access blocked',
  block_renewal_failed: 'Your subscription renewal failed. Please update your payment method to continue using CloseOS Business.',
  block_days_left_prefix: 'Account deletion in',
  block_days_left_day: 'day',
  block_days_left_suffix: 'if payment is not resolved.',
  block_deletion_in_progress: 'Your account deletion is in progress.',
  block_update_payment: 'Update payment',
  block_need_help: 'Need help?',

  // ─── Checkout ───
  checkout_title: 'Complete your registration',
  checkout_plan: 'Plan',
  checkout_billing: 'Billing',
  checkout_monthly: 'Monthly',
  checkout_quarterly: 'Quarterly',
  checkout_annual: 'Annual',
  checkout_promo: 'Promo code',
  checkout_apply: 'Apply',
  checkout_total: 'Total',
  checkout_submit: 'Sign up',
  checkout_creating_sub: 'Creating subscription...',
  checkout_creating_account: 'Creating account...',
  checkout_name: 'Full name',
  checkout_email: 'Email address',
  checkout_phone: 'Phone number',
  checkout_password: 'Password',
  checkout_confirm_password: 'Confirm password',
  checkout_passwords_mismatch: 'Passwords do not match.',
  checkout_password_strength: 'Security level',
  checkout_password_weak: 'Weak',
  checkout_password_medium: 'Medium',
  checkout_password_strong: 'Strong',
  checkout_password_very_strong: 'Very strong',
  checkout_trial_info: '20-day free trial',
  checkout_back: 'Back',
  checkout_your_plan: 'Your plan',
  checkout_billing_annual_desc: 'Annual billing',
  checkout_billing_quarterly_desc: 'Quarterly billing',
  checkout_billing_monthly_desc: 'Monthly billing',
  checkout_price_total_prefix: 'i.e.',
  checkout_trial_days_free: 'day free trial',
  checkout_hide_features: 'Hide features',
  checkout_show_features: 'See included features',
  checkout_promo_placeholder: 'Enter your code',
  checkout_promo_free_trial: 'Free trial activated!',
  checkout_promo_lifetime: 'Lifetime free access activated!',
  checkout_promo_extended: 'Trial extended!',
  checkout_promo_discount: 'Discount applied!',
  checkout_promo_applied: 'Code applied!',
  checkout_promo_invalid: 'Invalid or expired code',
  checkout_extras_label: 'Additional services (optional)',
  checkout_extras_total: '(one-time payment)',
  checkout_payment_section: 'Payment',
  checkout_card_saved: 'Card saved',
  checkout_create_account_section: 'Create your account',
  checkout_error_sales_email: 'This email is already linked to a CloseOS Sales account. Use a different email.',
  checkout_error_server: 'Server error',
  checkout_error_payment_failed: 'Payment failed.',
  checkout_error_generic: 'An error occurred.',
  checkout_validation_fields: 'Please fill in all fields (password: 8 characters minimum).',
  checkout_validation_payment: 'Please fill in your payment information.',
  checkout_step_verification: 'Verification...',
  checkout_step_payment: 'Payment validation...',
  checkout_loading: 'Loading...',
  checkout_launch: 'Launch',
  checkout_terms_text: 'By signing up, you agree to our',
  checkout_terms_cgu: 'Terms',
  checkout_terms_and: 'and our',
  checkout_terms_privacy: 'Privacy Policy',
  checkout_lifetime_free_title: 'Lifetime free access',
  checkout_days_offered: 'days offered',
  checkout_create_start: 'Create your account to start immediately',
  checkout_preparing_payment: 'Preparing payment...',
  checkout_already_account: 'Already have an account?',
  checkout_login: 'Log in',
  checkout_extra_setup_name: 'Setup',
  checkout_extra_setup_desc: 'Complete tool configuration: campaigns, plans, pipeline, team, onboarding.',
  checkout_extra_integration_name: 'Integration',
  checkout_extra_integration_desc: 'Technical integration on your site: iframe, embed, pop-up.',
  checkout_extra_combo_name: 'Setup + Integration',
  checkout_extra_combo_desc: 'Both combined \u2014 save \u20ac20.',

  // ─── Return (additional) ───
  return_payment_checking: 'Verifying payment...',
  return_payment_confirmed: 'Payment confirmed!',
  return_finalize_account: 'Finalize your account to access your space',
  return_email_label: 'Email (linked to payment)',
  return_password_label: 'Choose a password',
  return_password_placeholder: 'Minimum 8 characters',
  return_activate: 'Activate my account',
  return_error_sales_email: 'This email is already linked to a CloseOS Sales account. Please use a different email.',
  return_error_generic: 'An error occurred while creating the account.',
  return_terms_text: 'By signing up, you agree to our',
  return_terms_cgu: 'Terms',
  return_terms_and: 'and our',
  return_terms_privacy: 'Privacy Policy',
  return_copyright: 'All rights reserved.',

  // ─── Verification (additional) ───
  verification_required: 'Verification required',
  verification_code_sent_to: 'A code was sent to',
  verification_sending: 'Sending code...',
  verification_error_send: 'Unable to send the code',
  verification_error_invalid: 'Invalid or expired code',
  verification_resend_in: 'Resend in',
  verification_back_login: 'Back to login',

  // ─── Days ───
  day_mon: 'Mon',
  day_tue: 'Tue',
  day_wed: 'Wed',
  day_thu: 'Thu',
  day_fri: 'Fri',
  day_sat: 'Sat',
  day_sun: 'Sun',

  // ─── Months ───
  month_jan: 'January',
  month_feb: 'February',
  month_mar: 'March',
  month_apr: 'April',
  month_may: 'May',
  month_jun: 'June',
  month_jul: 'July',
  month_aug: 'August',
  month_sep: 'September',
  month_oct: 'October',
  month_nov: 'November',
  month_dec: 'December',

  // ─── Calls (CloserAppels) ───
  calls_title: 'Calls',
  calls_subtitle: 'Manage your calls, scripts and track your prospects.',
  calls_search_placeholder: 'Search a prospect or a call...',
  calls_quick_call: 'Quick Call',
  calls_new_call: 'New Call',
  calls_recent: 'Recent Calls',
  calls_finished: 'Finished',
  calls_no_calls: 'No recent calls.',
  calls_no_calls_desc: 'Start a call to begin.',
  calls_details: 'Details',
  calls_delete_confirm: 'Delete this call?',
  calls_deleted: 'Call deleted',
  calls_select_prospect: 'Select a prospect',
  calls_no_assigned_prospect: 'No assigned prospect',
  calls_prepare_call: 'Prepare the call',
  calls_prepare_title: 'Prepare the call',
  calls_open_meet: 'Open Meet',
  calls_launch_cockpit: 'Launch Cockpit',
  calls_meet_link_placeholder: 'Meet link (optional)',
  calls_script_saved: 'Script saved',
  calls_delete_script_confirm: 'Delete this script?',
  calls_new_script: '+ New Script',
  calls_script_title_placeholder: 'Script title',
  calls_script_write_placeholder: 'Write your script here...',
  calls_saving: 'Saving...',
  calls_no_slots_to_copy: 'No slots to copy',
  calls_ago_min: '{n} min ago',
  calls_ago_hours: '{n}h ago',
  calls_yesterday: 'Yesterday',
  calls_ago_days: '{n}d ago',
  calls_my_script: 'My Script',
  closer_appels_in_progress: 'In progress...',
  closer_appels_video_call: 'Video call',
  closer_appels_step1_open_meet: 'Step 1: Open Google Meet',
  closer_appels_step2_launch_cockpit: 'Step 2: Launch the cockpit',

  // ─── Invoices (CloserFactures) ───
  invoices_fixed_salary_title: 'Invoices & Fixed Salary',
  invoices_fixed_plus_commission_title: 'Invoices & Compensation',
  invoices_commission_title: 'Invoices & Commissions',
  invoices_fixed_salary_subtitle: 'Track your fixed salary and manage your invoices',
  invoices_fixed_plus_commission_subtitle: 'Track your fixed salary, commissions and manage your invoices',
  invoices_commission_subtitle: 'Track your commissions and manage your invoices',
  invoices_connect_stripe: 'Connect Stripe',
  invoices_issuer_info: 'Issuer Info',
  invoices_payment_methods: 'Payment Methods',
  invoices_generate_invoice: 'Generate invoice',
  invoices_period: 'Period',
  invoices_monthly: 'Monthly',
  invoices_fixed_salary: 'Fixed Salary',
  invoices_my_commission: 'My Commission',
  invoices_commission_closer: 'Closer Commission',
  invoices_commission_setter: 'Setter Commission',
  invoices_revenue_generated: 'Revenue Generated',
  invoices_paid: 'Paid',
  invoices_pending: 'Pending',
  invoices_period_details: 'Period details',
  invoices_cash_payment: 'Cash Payment',
  invoices_installment_payment: 'Installment Payment',
  invoices_total: 'Total',
  invoices_invoice_number: 'Invoice #',
  invoices_date_col: 'Date',
  invoices_client_offer: 'Client & Offer',
  invoices_amount_ttc: 'Amount (incl. tax)',
  invoices_due_date: 'Due Date',
  invoices_status_col: 'Status',
  invoices_actions_col: 'Actions',
  invoices_overdue: 'Overdue',
  invoices_link: 'Link',
  invoices_pay: 'Pay',
  invoices_view: 'View',
  invoices_no_invoices_period: 'No invoices for this period',
  invoices_status_to_pay: 'To pay',
  invoices_status_in_progress: 'In progress',
  invoices_status_paid_label: 'Paid',
  invoices_status_sent: 'Sent',
  invoices_status_generated: 'Generated',
  invoices_status_late: 'Overdue',
  invoices_status_waiting: 'Pending',
  invoices_status_draft: 'Draft',
  invoices_status_updated: 'Status updated',
  invoices_link_copied: 'Link copied',
  invoices_ca_label: 'Revenue',
  invoices_deal_label: 'deal',

  // ─── Invoices Owner ───
  invoices_owner_title: 'Invoices',
  invoices_owner_subtitle: 'All invoices from your organization',
  invoices_total_billed: 'Total billed',
  invoices_total_billed_global: 'Total billed (global)',
  invoices_paid_label: 'Paid',
  invoices_pending_label: 'Pending',
  invoices_pending_count: 'invoices',
  invoices_filter_period: 'Period',
  invoices_filter_member: 'Member',
  invoices_filter_all_members: 'All members',
  invoices_filter_status: 'Status',
  invoices_filter_all_statuses: 'All statuses',
  invoices_th_invoice_number: 'Invoice #',
  invoices_th_date: 'Date',
  invoices_th_client: 'Client',
  invoices_th_member: 'Member',
  invoices_th_amount: 'Amount',
  invoices_th_due_date: 'Due Date',
  invoices_th_status: 'Status',
  invoices_th_actions: 'Actions',
  invoices_copy_payment_link: 'Copy payment link',
  invoices_details_button: 'Details',
  invoices_download_button: 'Download',
  invoices_view_button: 'View',
  invoices_empty_title: 'No invoices',
  invoices_empty_desc: 'No invoices for this period',
  invoices_pagination_of: 'of',
  invoices_error_toast: 'Error loading invoices',

  // ─── Owner Factures ───
  owner_factures_title: 'Invoices',
  owner_factures_subtitle: 'All invoices from your organization',
  owner_factures_global: 'Global',
  owner_factures_total_billed: 'Total billed',
  owner_factures_paid: 'Paid',
  owner_factures_pending: 'Pending',
  owner_factures_invoice_singular: 'invoice',
  owner_factures_invoices_plural: 'invoices',
  owner_factures_period: 'Period',
  owner_factures_member: 'Member',
  owner_factures_all_members: 'All members',
  owner_factures_status: 'Status',
  owner_factures_all_statuses: 'All statuses',
  owner_factures_th_invoice_number: 'Invoice #',
  owner_factures_th_date: 'Date',
  owner_factures_th_client: 'Client',
  owner_factures_th_member: 'Member',
  owner_factures_th_amount: 'Amount',
  owner_factures_th_due_date: 'Due Date',
  owner_factures_th_status: 'Status',
  owner_factures_th_actions: 'Actions',
  owner_factures_status_updated: 'Status updated',
  owner_factures_late: 'Overdue',
  owner_factures_link_copied: 'Link copied',
  owner_factures_copy_payment_link: 'Copy payment link',
  owner_factures_link: 'Link',
  owner_factures_pay: 'Pay',
  owner_factures_view: 'View',
  owner_factures_download: 'Download',
  owner_factures_details: 'Details',
  owner_factures_empty_title: 'No invoices',
  owner_factures_empty_desc: 'No invoices for this period',
  owner_factures_of: 'of',
  owner_factures_status_to_pay: 'To pay',
  owner_factures_status_in_progress: 'In progress',
  owner_factures_status_paid: 'Paid',
  owner_factures_status_sent: 'Sent',
  owner_factures_status_generated: 'Generated',
  owner_factures_status_overdue: 'Overdue',
  owner_factures_status_waiting: 'Pending',
  owner_factures_status_draft: 'Draft',

  // ─── Misc ───
  empty_state_title: 'Nothing here yet',
  empty_state_desc: 'Data will appear here once you start using CloseOS.',
  error_generic: 'An error occurred',
  error_network: 'Connection error',
  error_unauthorized: 'Unauthorized access',
  coming_soon: 'Coming soon',
  beta_badge: 'Beta',

  // ─── CRM Stages ───
  stage_prospect: 'Prospect',
  stage_qualified: 'Qualified',
  stage_unqualified: 'Unqualified',
  stage_won: 'Won',
  stage_lost: 'Lost',
  stage_noanswer: 'No Answer',
  stage_noshow: 'No Show',
  stage_followup: 'Follow-up',

  // ─── Extra common strings ───
  common_phone_label: 'Phone',
  common_stage: 'Stage',
  common_period: 'Period',
  common_assigned_to: 'Assigned to',
  common_assign_to: 'Assign to',
  common_duration: 'Duration',
  common_details: 'Details',
  common_team: 'Team',
  common_create: 'Create',
  common_creating: 'Creating...',
  common_select: 'Select',
  common_no_data_available: 'No data',
  common_first_name: 'First name',
  common_last_name: 'Last name',
  common_done: 'Done',
  common_confirmed: 'Confirmed',
  common_cancelled: 'Cancelled',
  common_paid: 'Paid',
  common_to_pay: 'To pay',
  common_link_copied: 'Link copied',
  common_config_saved: 'Configuration saved',
  common_network_error: 'Network error',
  common_creation_error: 'Error during creation',
  common_status_updated: 'Status updated',
  common_video: 'Video',
  common_custom: 'Custom',
  common_system: 'System',
  common_all_teams: 'All teams',
  common_whole_team: 'Whole team',
  common_all_day: 'All day',
  common_all_periods: 'All periods',
  common_revenue_generated: 'Revenue',
  common_no_appointments: 'No upcoming appointments',
  common_deadline: 'Deadline',
  common_past: 'Past',
  common_reminder_created: 'Reminder created',
  common_create_reminder: 'Create reminder',
  common_select_stage: 'Select a stage',
  common_select_reason: 'Select a reason',
  common_visio: 'Video call',
  common_integration_instructions: 'Integration instructions',
  common_generate_api_key: 'Generate API key',
  common_reset_all: 'Reset all',
  common_at: 'at',

  // ─── Loss reasons ───
  loss_thinking: 'Need to think about it',
  loss_budget: 'Money/budget',
  loss_need_talk: 'Need to discuss',
  loss_not_now: 'Not the right time',
  loss_fear: 'Fear',
  loss_smokescreen: 'Smokescreen',
  loss_other: 'Other',

  // ─── Closer-specific ───
  closer_step1_assign: 'Step 1 — Assign a Closer',
  closer_step2_schedule: 'Step 2 — Schedule appointment',
  closer_auto_assigned: 'Closer auto-assigned',
  closer_random: 'Random',

  // ─── Pipeline-specific ───
  pipeline_custom_statuses: 'Custom Statuses',
  pipeline_created_by_team: 'Created by your team',
  pipeline_auto_reset: 'Auto Reset',
  pipeline_auto_reset_desc: 'Clear the pipeline periodically',
  pipeline_enable_reset: 'Enable reset',
  pipeline_reset_keeps_crm: 'Prospects will be removed from the pipeline but kept in the CRM',
  pipeline_frequency: 'Frequency',
  pipeline_columns_to_clear: 'Columns to clear',
  pipeline_columns_desc: 'Select the statuses whose prospects will be removed from the pipeline',
  pipeline_by_default: 'default',
  pipeline_last_reset: 'Last reset',
  pipeline_priority_ops: 'Priority Operations',
  pipeline_elements: 'items',
  pipeline_no_prospects: 'No prospects found',
  pipeline_create_status: 'Create status',
  pipeline_search: 'Search...',
  pipeline_filters: 'Filters',
  pipeline_reset_all: 'Reset all',
  pipeline_new_status: 'New status',
  pipeline_config_title: 'Pipeline configuration',
  pipeline_config_pipeline: 'Pipeline configuration',
  pipeline_period: 'Period',
  pipeline_period_all: 'All',
  pipeline_period_7days: '7 days',
  pipeline_period_30days: '30 days',
  pipeline_period_90days: '90 days',
  pipeline_team: 'Team',
  pipeline_closer_setter: 'Closer / Setter',
  pipeline_no_members: 'No members',
  pipeline_stage: 'Stage',
  pipeline_offer_formula: 'Offer / Plan',
  pipeline_no_formulas: 'No plans',
  pipeline_tags: 'Tags',
  pipeline_no_tags: 'No tags',
  pipeline_prospect_no_name: 'Unnamed prospect',
  pipeline_prospect_count: 'prospect',
  pipeline_prospect_count_plural: 'prospects',
  pipeline_no_prospect_found: 'No prospects found',
  pipeline_active_flow: 'Active Flow',
  pipeline_inactive_flow: 'Inactive Flow',
  pipeline_archives: 'Archives & Rejected',
  pipeline_custom_stages: 'Custom Stages',
  pipeline_no_prospect: 'No prospects',
  pipeline_contact_header: 'Contact',
  pipeline_company_header: 'Company',
  pipeline_stage_header: 'Stage',
  pipeline_tags_header: 'Tags',
  pipeline_assigned_header: 'Assigned to',
  pipeline_value_header: 'Value',
  pipeline_date_header: 'Date',
  pipeline_actions_header: 'Actions',
  pipeline_enable_reset_desc: 'Prospects will be removed from the pipeline but kept in the CRM',
  pipeline_weekly: 'Every week',
  pipeline_biweekly: 'Every 2 weeks',
  pipeline_monthly: 'Every month',
  pipeline_default_label: 'default',
  pipeline_saving: 'Saving...',
  pipeline_config_saved: 'Configuration saved',
  pipeline_save_error: 'Error saving configuration',
  pipeline_new_stage_title: 'New status',
  pipeline_crm_warning: 'Your integrated CRM does not support custom statuses. Only Zapier and Make are compatible.',
  pipeline_crm_warning_text: 'Your integrated CRM ({provider}) does not support custom statuses. Only Zapier and Make are compatible.',
  pipeline_stage_title_label: 'Title',
  pipeline_stage_title_placeholder: 'e.g. Negotiation',
  pipeline_stage_desc: 'Description',
  pipeline_stage_desc_placeholder: 'Optional',
  pipeline_stage_color: 'Color',
  pipeline_stage_roles: 'Applicable roles',
  pipeline_stage_creating: 'Creating...',
  pipeline_stage_create: 'Create status',
  pipeline_stage_created: 'Status created successfully',
  pipeline_stage_create_error: 'Error creating status',
  pipeline_delete_stage_confirm: 'Delete status "{name}"?',
  pipeline_at: 'at',
  pipeline_stage_prospect: 'Prospect',
  pipeline_stage_qualified: 'Qualified',
  pipeline_stage_unqualified: 'Unqualified',
  pipeline_stage_won: 'Won',
  pipeline_stage_followup: 'Follow Up',
  pipeline_stage_noanswer: 'No Answer',
  pipeline_stage_noshow: 'No Show',
  pipeline_stage_lost: 'Lost',

  // ─── Organization-specific ───
  org_desc_page: 'Information and onboarding paths for your organization.',
  org_no_info: 'No information provided by the organization.',
  org_general_onboarding: 'General Onboarding',
  org_onboarding_path: 'Integration path for your organization',
  org_role_onboarding_path: 'Role-specific path',
  org_onboarding_validated: 'You have completed the onboarding.',
  org_logo_updated: 'Logo updated!',
  org_updated: 'Organization updated successfully!',
  org_owner: 'Owner',
  org_customize_brand: 'Customize your brand identity and set up team onboarding paths.',
  org_vat_number: 'VAT Number',
  org_general_onboarding_desc: 'This onboarding will be shown to all new team members during integration.',
  org_role_onboarding_desc: 'This onboarding will only be shown to members with the role',
  org_first_step: 'Create your first integration step',
  org_role_step: 'Create a specific path for',
  org_custom_tab: 'Custom tab — double-click name to rename',
  org_add_sections: 'Add sections with text, videos or links',
  org_write_here: 'Write your text here...',
  org_video_url: 'Video URL (YouTube, Loom...)',
  org_connected: 'Connected',
  org_integration: 'Integration',
  org_subtitle: 'Information and onboarding paths for your organization.',
  org_subtitle_owner: 'Customize your brand identity and set up team onboarding paths.',
  org_tab_organisation: 'ORGANIZATION',
  org_tab_onboarding: 'ONBOARDING',
  org_tab_add: 'TAB',
  org_save_button: 'SAVE',
  org_brand_identity: 'Brand Identity',
  org_company_logo: 'Company logo',
  org_company_logo_hint: 'SVG, PNG, or JPG. Max 5MB.',
  org_company_name_label: 'Company name',
  org_company_name_placeholder: 'Your company',
  org_description_label: 'Description',
  org_description_placeholder: 'What your company does...',
  org_website_label: 'Website',
  org_contact_email_label: 'Contact email',
  org_phone_label: 'Phone',
  org_address_label: 'Address',
  org_billing_title: 'Billing',
  org_billing_subtitle: 'Information for your invoices and official documents',
  org_raison_sociale_label: 'Legal name',
  org_raison_sociale_placeholder: 'Legal name of your company',
  org_siret_label: 'SIRET',
  org_tva_label: 'VAT Number',
  org_billing_address_label: 'Billing address',
  org_billing_zip_label: 'Zip code',
  org_billing_city_label: 'City',
  org_billing_country_label: 'Country',
  org_info_title: 'Information',
  org_email_label: 'Email',
  org_phone_info_label: 'Phone',
  org_address_info_label: 'Address',
  org_persons: 'pers.',
  org_cancel_crop: 'Cancel',
  org_validate_logo: 'Validate logo',
  org_logo_upload_error: 'Error uploading logo.',
  org_save_success: 'Organization updated successfully!',
  org_save_error: 'Error saving.',
  org_new_tab: 'New tab',
  org_untitled: 'Untitled',
  org_custom_tab_subtitle: 'Custom tab — double-click name to rename',
  org_section_name_placeholder: 'New section name...',
  org_add_section: 'Add',
  org_text_block: 'Text',
  org_video_block: 'Video',
  org_link_block: 'Link',
  org_pdf_block: 'PDF',
  org_text_placeholder: 'Write your text here...',
  org_video_placeholder: 'Video URL (YouTube, Loom...)',
  org_link_title_placeholder: 'Link title',
  org_upload_in_progress: 'Uploading...',
  org_choose_pdf: 'Choose a PDF file',
  org_view_pdf: 'View PDF',
  org_no_content: 'No content available.',
  org_section_empty: 'Empty section',
  org_empty_sections_label: 'No sections',
  org_empty_sections_desc: 'Add sections with text, videos or links',
  org_onboarding_guide: 'Onboarding Guide',
  org_onboarding_guide_desc: 'Required reading before starting. Click to open the full guide.',
  org_onboarding_general: 'General Onboarding',
  org_onboarding_general_desc: 'Integration path for your organization',
  org_onboarding_role: 'Onboarding',
  org_onboarding_role_desc: 'Role-specific path',
  org_onboarding_ack_button: 'I HAVE READ AND UNDERSTOOD THE ONBOARDING',
  org_onboarding_ack_done: 'You have completed the onboarding.',
  org_onboarding_active_path: 'Active path',
  org_onboarding_path_blocks: 'Path blocks',
  org_onboarding_general_info: 'This onboarding will be shown to all new team members during integration.',
  org_onboarding_role_info: 'This onboarding will only be shown to members with the role',
  org_no_onboarding_sections: 'No onboarding sections',
  org_no_onboarding_sections_desc: 'Create your first integration step',
  org_no_role_sections: 'No sections for',
  org_no_role_sections_desc: 'Create a specific path for',
  org_no_custom_sections: 'No sections',
  org_no_custom_sections_desc: 'Add sections with text, videos or links',
  org_view: 'View',

  // ─── CRM-specific extra ───
  crm_tag_exists: 'This tag already exists',
  crm_tag_created: 'Tag created',
  crm_tag_deleted: 'Tag deleted',
  crm_manage_tags: 'Manage tags',
  crm_manage_tags_desc: 'Create and manage tags to organize your prospects.',
  crm_no_tags: 'No tags created',
  crm_no_prospects_found: 'No prospects found',
  crm_7_days: '7 days',
  crm_30_days: '30 days',
  crm_90_days: '90 days',
  crm_stage_prospect: 'Prospect',
  crm_stage_qualified: 'Qualified',
  crm_stage_unqualified: 'Unqualified',
  crm_stage_won: 'Won',
  crm_stage_followup: 'Follow up',
  crm_stage_noanswer: 'No answer',
  crm_stage_noshow: 'No-show',
  crm_stage_lost: 'Lost',
  crm_connected: 'Connected',
  crm_auto_sync_in: 'Auto sync in {time}',
  crm_your_pipeline: 'Your pipeline',
  crm_integration: 'Integration',
  crm_filters: 'Filters',
  crm_export: 'Export',
  crm_new_prospect: 'New prospect',
  crm_reset_all: 'Reset all',
  crm_period: 'Period',
  crm_team: 'Team',
  crm_closer_setter: 'Closer / Setter',
  crm_no_members: 'No members',
  crm_stage: 'Stage',
  crm_offer_formula: 'Offer / Plan',
  crm_no_formulas: 'No plans',
  crm_no_tags_created: 'No tags created',
  crm_system_tag: 'System',
  crm_no_prospect_found: 'No prospects found',
  crm_contact_header: 'Contact',
  crm_company_header: 'Company',
  crm_email_header: 'Email',
  crm_phone_header: 'Phone',
  crm_stage_header: 'Stage',
  crm_tags_header: 'Tags',
  crm_value_header: 'Value',
  crm_date_header: 'Date',
  crm_actions_header: 'Actions',
  crm_prospects_plural: 'prospects',
  crm_prospect_singular: 'prospect',
  crm_prospect_no_name: 'Unnamed',
  crm_contact_name: 'Contact name',
  crm_contact_name_placeholder: 'John Doe',
  crm_email_label: 'Email',
  crm_phone_label: 'Phone',
  crm_company_label: 'Company',
  crm_offer_label: 'Offer',
  crm_no_offer: 'No offer',
  crm_setter_label: 'Setter',
  crm_no_setter: 'No setter',
  crm_choose_setter: 'Choose a setter',
  crm_closer_label: 'Closer',
  crm_no_closer: 'No closer',
  crm_round_robin: 'Round robin',
  crm_random: 'Random',
  crm_you: '(you)',
  crm_closer_auto_assigned: 'Closer auto-assigned',
  crm_optional: '(optional)',
  crm_delete_tag_confirm: 'Delete this tag?',
  crm_tag_name_placeholder: 'Tag name',

  // ─── Appointments/Agenda extra ───
  appointments_book_later: 'Book later',

  // ─── CloserRendezVous ───
  appointments_my_title: 'My Appointments',
  appointments_assigned_count: '{n} assigned appointments',
  appointments_all_statuses: 'All statuses',
  appointments_date_from: 'From',
  appointments_date_to: 'To',
  appointments_reset_filters: 'Reset',
  appointments_no_appointments_title: 'No appointments',
  appointments_no_assigned: 'No appointments assigned to you',
  appointments_no_matching_filters: 'No appointments match your filters',
  appointments_date_time: 'Date & Time',
  appointments_contact: 'Contact',
  appointments_email: 'Email',
  appointments_campaign: 'Campaign',
  appointments_duration: 'Duration',
  appointments_status: 'Status',
  appointments_reassign: 'Reassign',
  appointments_mark_done: 'Done',
  appointments_reassign_title: 'Reassign appointment',
  appointments_reassign_desc: 'Select a team member to assign this appointment to.',
  appointments_no_member_available: 'No other member available',
  appointments_confirm_reassign: 'Confirm reassignment',
  appointments_reassigned: 'Appointment reassigned',
  appointments_reassign_error: 'Error reassigning',
  appointments_status_updated: 'Status updated',
  appointments_time_past: 'Past',
  appointments_time_soon: 'Soon',
  appointments_time_ongoing: 'Ongoing',
  appointments_time_future: 'Future',
  appointments_at_time: 'at',
  appointments_at_member: 'with',

  // ─── BusinessAppointments (Owner page) ───
  appointments_timing_1d: '1 day before',
  appointments_timing_10h: '10am same day',
  appointments_timing_5h: '5h before',
  appointments_timing_3h: '3h before',
  appointments_timing_1h: '1h before',
  appointments_timing_30m: '30 min before',
  appointments_timing_15m: '15 min before',
  appointments_timing_now: 'Immediately',
  appointments_var_lead_name: 'Lead name',
  appointments_var_assignee_name: 'Assignee name',
  appointments_var_title: 'Appointment title',
  appointments_var_date: 'Appointment date',
  appointments_var_time: 'Appointment time',
  appointments_var_meet_link: 'Google Meet link',
  appointments_var_reschedule_link: 'Reschedule link',
  appointments_var_cancel_link: 'Cancel link',
  appointments_new_reminder: 'New reminder',
  appointments_reminder_subject: 'Reminder for your appointment',
  appointments_manual_reminder: 'Manual reminder',
  appointments_reminder_updated: 'Reminder updated',
  appointments_reminder_created: 'Reminder created',
  appointments_save_error: 'Error saving',
  appointments_reminder_deleted: 'Reminder deleted',
  appointments_reminder_enabled: 'Reminder enabled',
  appointments_reminder_disabled: 'Reminder disabled',
  appointments_send_reminder_error: 'Error sending reminder',
  appointments_reminder_sent_to: 'Reminder sent to',
  appointments_send_error: 'Send error',
  appointments_create_error: 'Error creating',
  appointments_booking_link_created: 'Booking link created',
  appointments_link_deleted: 'Link deleted',
  appointments_update_error: 'Error updating',
  appointments_link_updated: 'Link updated',
  appointments_link_copied: 'Link copied',
  appointments_deleted: 'Appointment deleted',
  appointments_delete_error: 'Error deleting',
  appointments_date_time_required: 'Date and time are required',
  appointments_created_with_meet: 'Appointment created with Google Meet',
  appointments_created: 'Appointment created',
  appointments_configure_reminders: 'Configure reminders',
  appointments_manage_personal: 'Manage my appointments',
  appointments_all_team: 'All team',
  appointments_manage_calendar: 'Manage calendar',
  appointments_tab_personal: 'Personal',
  appointments_tab_member: 'By member',
  appointments_all_members: 'All members',
  appointments_status_all: 'All statuses',
  appointments_book_rdv: 'Book an appointment',
  appointments_new_rdv: 'New appointment',
  appointments_schedule_new: 'Schedule a new appointment for your team.',
  appointments_event_title: 'Event title',
  appointments_label_date: 'Date',
  appointments_label_time: 'Time',
  appointments_assign_to: 'Assign to',
  appointments_for_me: 'For me',
  appointments_internal_notes: 'Internal notes',
  appointments_enable_google_meet: 'Enable Google Meet',
  appointments_connect_google_calendar: 'Connect Google Calendar',
  appointments_confirm_rdv: 'Confirm appointment',
  appointments_edit_reminder: 'Edit reminder',
  appointments_email_reminders: 'Email reminders',
  appointments_configure_reminder_desc: 'Configure the details of this reminder.',
  appointments_auto_reminders_desc: 'Automatically send reminders to prospects before their appointments.',
  appointments_manual_reminder_label: 'Manual reminder',
  appointments_custom: 'Custom',
  appointments_standard: 'Standard',
  appointments_sent_manually_desc: 'Sent manually from the appointment card.',
  appointments_configure_manual_reminder: 'Configure manual reminder',
  appointments_auto_reminders: 'Automatic reminders',
  appointments_no_auto_reminders: 'No automatic reminders configured',
  appointments_add_auto_reminder: 'Add automatic reminder',
  appointments_reminder_name: 'Reminder name',
  appointments_when_to_send: 'When to send',
  appointments_manual_reminder_desc: 'This reminder will be sent manually.',
  appointments_template_type: 'Template type',
  appointments_sender_name: 'Sender name',
  appointments_email_always_from: 'Emails are always sent from support@closeos.fr',
  appointments_email_subject: 'Email subject',
  appointments_available_variables: 'Available variables',
  appointments_html_content: 'HTML content',
  appointments_preview: 'Preview',
  appointments_update: 'Update',
  appointments_create_reminder: 'Create reminder',
  appointments_will_appear_here: 'Your appointments will appear here',

  // ─── Stripe Match Modal ───
  stripe_match_title: 'Link a Stripe subscription',
  stripe_match_search_by_email: 'Search by email',
  stripe_match_manual_entry: 'Manual entry',
  stripe_match_email_placeholder: 'Stripe customer email',
  stripe_match_no_results: 'No Stripe customer found for this email.',
  stripe_match_enter_ids_manually: 'Enter IDs manually',
  stripe_match_no_subscription: 'No subscription',
  stripe_match_per_month: 'month',
  stripe_match_per_year: 'year',
  stripe_match_customer_id: 'Stripe Customer ID',
  stripe_match_subscription_id: 'Stripe Subscription ID',
  stripe_match_link_subscription: 'Link this subscription',

  // ─── Team Role Page ───
  team_role_global_view: 'Global view',
  team_role_no_member_found: 'No member found',
  team_role_no_member_desc: 'No member with this role in your team. Invite members from the Team page.',
  team_role_in_team_since: 'In team since',
  team_role_prospects_assigned: 'prospect assigned',
  team_role_prospects_assigned_plural: 'prospects assigned',
  team_role_sales_count: 'sale',
  team_role_sales_count_plural: 'sales',
  team_role_slots_count: 'slot',
  team_role_slots_count_plural: 'slots',
  team_role_absences_recorded: 'absence recorded',
  team_role_absences_recorded_plural: 'absences recorded',
  team_role_global_summary: 'Global summary',
  team_role_assigned_prospects: 'Assigned prospects',
  team_role_sales_label: 'Sales',
  team_role_ca_generated: 'Revenue generated',
  team_role_conversion_rate: 'Conversion rate',
  team_role_no_birthdate: 'Date of birth not provided',
  team_role_arrival_on: 'Joined on',
  team_role_connection: 'Connected',
  team_role_disconnection: 'Disconnected',
  team_role_connection_history: 'Connection history',
  team_role_last_7_days: 'Last 7 days',
  team_role_no_connection_history: 'No connection history',
  team_role_monthly_pay_date: 'Monthly pay date',
  team_role_the_day: 'The',
  team_role_each_month: 'of each month',
  team_role_next_payment_on: 'Next payment on',
  team_role_conversion: 'Conversion',
  team_role_lost: 'Lost',
  team_role_pipeline: 'Pipeline',
  team_role_total: 'total',
  team_role_availability: 'Availability',
  team_role_no_slots: 'No slot configured',
  team_role_no_availability_desc: 'The member has not yet filled in their availability',
  team_role_absences: 'Absences',
  team_role_no_absences: 'No absence recorded',
  team_role_upcoming_appointments: 'Upcoming appointments',
  team_role_rdv: 'appts',
  team_role_no_upcoming_appointments: 'No upcoming appointments',
  team_role_confirmed: 'Confirmed',
  team_role_done: 'Done',
  team_role_pending: 'Pending',
  team_role_at: 'at',
  team_role_day_mon: 'Monday',
  team_role_day_tue: 'Tuesday',
  team_role_day_wed: 'Wednesday',
  team_role_day_thu: 'Thursday',
  team_role_day_fri: 'Friday',
  team_role_day_sat: 'Saturday',
  team_role_day_sun: 'Sunday',
  team_role_stage_prospect: 'Prospect',
  team_role_stage_qualified: 'Qualified',
  team_role_stage_followup: 'Follow Up',
  team_role_stage_won: 'Won',
  team_role_stage_noshow: 'No Show',
  team_role_stage_lost: 'Lost',

  // ─── Team Kanban ───
  kanban_title: 'Team organization',
  kanban_new_team: 'New team',
  kanban_team_name_placeholder: 'Team name...',
  kanban_unassigned: 'Unassigned',
  kanban_add: 'Add',
  kanban_all_assigned: 'All members are assigned',
  kanban_create_first_team: 'Create your first team',
  kanban_no_teams: 'No team created',
  kanban_no_role: 'No role',
  kanban_no_members: 'No member',
  kanban_create_error: 'Error creating team',
  kanban_team_created: 'Team created',
  kanban_error: 'Error',
  kanban_team_deleted: 'Team deleted',
  kanban_name_updated: 'Name updated',

  // ─── Reminder Bell ───
  reminder_bell_billing_approaching: 'Billing date approaching',
  reminder_bell_billing_desc: '{date} is your billing date. Remember to prepare your documents.',
  reminder_bell_today_reminders: "Today's reminders",
  reminder_bell_view_all: 'View all',
  reminder_bell_no_reminders: 'No reminders for today',
  reminder_bell_overdue: 'Overdue',
  reminder_bell_mark_done: 'Mark as done',
  reminder_bell_hide: 'Hide',
  // ─── Issuer Profiles Modal ───
  issuer_title: 'Issuer Profiles',
  issuer_subtitle: 'Manage your company information',
  issuer_add_profile: 'Add issuer profile',
  issuer_edit_profile: 'Edit',
  issuer_new_profile: 'New',
  issuer_profile_name_label: 'Profile name (e.g. My Company)',
  issuer_company_name_label: 'Company name',
  issuer_address_label: 'Address',
  issuer_city_label: 'City',
  issuer_zip_label: 'Zip Code',
  issuer_country_label: 'Country',
  issuer_siret_label: 'SIRET',
  issuer_email_label: 'Email',
  issuer_phone_label: 'Phone',
  issuer_default: 'Default',
  issuer_no_profiles: 'No profiles saved.',
  issuer_delete_confirm: 'Delete?',
  issuer_session_expired: 'Session expired, please reconnect.',
  issuer_save_error: 'Error saving. Check your connection.',
  issuer_validation_error: 'Please enter at least a profile name and a company name',
  // ─── Payment Methods Modal ───
  payment_methods_title: 'Payment Methods',
  payment_methods_add: 'Add a payment method',
  payment_methods_edit_title: 'Edit',
  payment_methods_new_title: 'New',
  payment_methods_name_label: 'Name',
  payment_methods_type_label: 'Type',
  payment_methods_bank_label: 'Bank',
  payment_methods_bank_placeholder: 'Bank name',
  payment_methods_iban_label: 'IBAN',
  payment_methods_bic_label: 'BIC',
  payment_methods_holder_label: 'Account holder',
  payment_methods_holder_placeholder: 'Account holder name',
  payment_methods_paypal_email_label: 'PayPal Email',
  payment_methods_revtag_label: 'Revtag',
  payment_methods_stripe_link_label: 'Stripe payment link',
  payment_methods_default: 'Default',
  payment_methods_set_default: 'Set as default',
  payment_methods_delete_confirm: 'Delete this payment method?',
  payment_methods_no_methods: 'No payment methods.',
  payment_methods_no_methods_desc: 'Add a payment method for your invoices.',
  payment_methods_session_expired: 'Session expired',
  payment_methods_save_error: 'Error saving',
  payment_methods_name_required: 'Name required',
  payment_methods_name_placeholder: 'E.g. Main account',
  // ─── Export Prospects Modal ───
  export_title: 'Export prospects',
  export_filters: 'Filters',
  export_period_label: 'Period',
  export_period_all: 'All',
  export_period_today: 'Today',
  export_period_7days: '7 days',
  export_period_30days: '30 days',
  export_period_90days: '90 days',
  export_closer_setter: 'Closer / Setter',
  export_status_label: 'Status',
  export_offer_formula: 'Offer / Plan',
  export_tags_label: 'Tags',
  export_custom_period: 'Custom period',
  export_date_from: 'From',
  export_date_to: 'To',
  export_columns: 'Columns',
  export_select_all: 'Select all',
  export_deselect_all: 'Deselect all',
  export_col_name: 'Name',
  export_col_firstname: 'First name',
  export_col_lastname: 'Last name',
  export_col_email: 'Email',
  export_col_phone: 'Phone',
  export_col_company: 'Company',
  export_col_stage: 'Stage',
  export_col_value: 'Value',
  export_col_offer: 'Plan',
  export_col_created: 'Created date',
  export_col_notes: 'Notes',
  export_button: 'Export',
  export_toast: 'prospects exported',
  export_stage_prospect: 'Prospect',
  export_stage_qualified: 'Qualified',
  export_stage_unqualified: 'Unqualified',
  export_stage_won: 'Won',
  export_stage_followup: 'Follow Up',
  export_stage_noanswer: 'No Answer',
  export_stage_noshow: 'No Show',
  export_stage_lost: 'Lost',
  export_stage_label_prospect: 'Prospect',
  export_stage_label_qualified: 'Qualified',
  export_stage_label_unqualified: 'Unqualified',
  export_stage_label_won: 'Won',
  export_stage_label_followup: 'Follow-up',
  export_stage_label_noanswer: 'No answer',
  export_stage_label_noshow: 'No Show',
  export_stage_label_lost: 'Lost',
  // ─── Stripe Connect Modal ───
  stripe_connect_title: 'Stripe Connection',
  stripe_connect_checking: 'Checking status...',
  stripe_connect_active: 'Account active',
  stripe_connect_close: 'Close',
  stripe_connect_disconnect: 'Disconnect',
  stripe_connect_disconnect_confirm: 'Do you really want to disconnect your Stripe account?',
  stripe_connect_connected: 'Connected',
  stripe_connect_btn: 'Connect my Stripe account',
  stripe_connect_redirect: 'Secure redirect to Stripe Connect',
  stripe_connect_error_init: 'Error initializing Stripe. Please try again.',
  stripe_connect_error_server: 'Unable to contact the payment server.',
  stripe_connect_benefit_1: 'Receive your commissions by card directly to your bank account.',
  stripe_connect_benefit_2: 'Your clients pay in 1 click from the invoice PDF.',
  stripe_connect_connected_desc: 'Your Stripe account is properly linked. You can receive payments directly on your invoices.',
  stripe_connect_campaign_benefit_1: 'Charge for appointments directly through your campaigns.',
  stripe_connect_campaign_benefit_2: 'CloseOS takes a 2% service fee on each transaction.',
  stripe_connect_campaign_benefit_3: 'Configurable tiered refunds + paid rescheduling.',
  stripe_connect_campaign_connected_desc: 'Your Stripe account is connected. You can enable payments on your campaigns.',
  // ─── Issuer Profiles Modal (extra) ───
  issuer_form_title_edit: 'Edit profile',
  issuer_form_title_new: 'New profile',
  // ─── Payment Methods Modal (extra) ───
  payment_methods_form_title_edit: 'Edit payment method',
  payment_methods_form_title_new: 'New payment method',
  // ─── Invoice Generator Modal (extra) ───
  invoice_gen_penalty_default: 'In case of late payment, late penalties at an annual rate of {rate}%.\nFixed recovery indemnity: {amount}.',
  invoice_gen_invoice_number_pdf: 'Invoice number:',
  invoice_gen_from_to: 'From {start} to {end}',
  // ─── Invoice Generator Modal ───
  invoice_gen_config_title: 'Invoice Configuration',
  invoice_gen_invoice_number: 'Invoice Number',
  invoice_gen_saved_profile: 'Saved Issuer Profile',
  invoice_gen_manual_entry: 'Manual entry...',
  invoice_gen_issuer_name: 'Issuer Name / Company',
  invoice_gen_address: 'Address',
  invoice_gen_city: 'City',
  invoice_gen_zip: 'Zip Code',
  invoice_gen_country: 'Country',
  invoice_gen_siret: 'SIRET',
  invoice_gen_email: 'Email',
  invoice_gen_phone: 'Phone',
  invoice_gen_payment_method: 'Main payment method',
  invoice_gen_bank_transfer: 'Bank Transfer',
  invoice_gen_other_manual_link: 'Other manual link',
  invoice_gen_stripe_toggle: 'Online payment service (Stripe)',
  invoice_gen_stripe_recommended: 'Recommended',
  invoice_gen_stripe_desc: 'Adds a secure payment button + QR Code on the invoice to get paid by card instantly.',
  invoice_gen_tva_toggle: 'VAT Applicable?',
  invoice_gen_tva_desc: 'Add 20% VAT to the commission amount',
  invoice_gen_late_penalties: 'Late payment penalties',
  invoice_gen_annual_rate: 'Annual rate (%)',
  invoice_gen_fixed_indemnity: 'Fixed indemnity (EUR)',
  invoice_gen_preview: 'Preview invoice',
  invoice_gen_generating_stripe: 'Generating Stripe link...',
  invoice_gen_back: 'Back',
  invoice_gen_validating: 'Validating...',
  invoice_gen_validate: 'Validate invoice',
  invoice_gen_edit_invoice: 'Edit invoice',
  invoice_gen_doc_title: 'Document title',
  invoice_gen_invoice_number_label: 'Invoice number',
  invoice_gen_due_date: 'Due date',
  invoice_gen_closer_lines: 'Closer Lines',
  invoice_gen_setter_lines: 'Setter Lines',
  invoice_gen_add_closer_line: 'Add a Closer line',
  invoice_gen_add_setter_line: 'Add a Setter line',
  invoice_gen_add_product: 'Add a product',
  invoice_gen_description: 'Description',
  invoice_gen_subtitle_placeholder: 'Subtitle / description (optional)',
  invoice_gen_qty: 'Qty',
  invoice_gen_unit_price: 'Unit price (EUR)',
  invoice_gen_section_title_placeholder: 'Section title',
  invoice_gen_stripe_show_toggle: 'Show Stripe payment on invoice',
  invoice_gen_penalty_mentions: 'Late penalty mentions',
  invoice_gen_penalty_placeholder: 'E.g. In case of late payment...',
  invoice_gen_footer_note: 'Free note (invoice footer)',
  invoice_gen_footer_placeholder: 'Add a note, a comment...',
  invoice_gen_total_ht: 'Total excl. tax',
  invoice_gen_total_ttc: 'Total incl. tax',
  invoice_gen_issuer_label: 'Issuer',
  invoice_gen_receiver_label: 'Recipient',
  invoice_gen_period_label: 'Period:',
  invoice_gen_commission_closer: 'Closer Commission',
  invoice_gen_commission_setter: 'Setter Commission',
  invoice_gen_col_description: 'Description',
  invoice_gen_col_qty: 'Qty',
  invoice_gen_col_unit_price: 'Unit Price',
  invoice_gen_col_total_ht: 'Total excl. tax',
  invoice_gen_payment_terms: 'Payment terms',
  invoice_gen_due_label: 'Due:',
  invoice_gen_payment_mode: 'Payment mode:',
  invoice_gen_bank_details: 'Bank details',
  invoice_gen_tva_not_applicable: 'VAT not applicable, art. 293 B of CGI',
  invoice_gen_pay_online: 'Pay online',
  invoice_gen_scan_to_pay: 'Scan to pay by card instantly',
  invoice_gen_pay_now: 'Pay now',
  invoice_gen_generated_by: 'Invoice automatically generated by CloseOS',
  invoice_gen_fixed_salary: 'Fixed Monthly Salary',
  invoice_gen_new_line: 'New line',
  invoice_gen_no_commission_error: 'No commission to invoice for this period',
  invoice_gen_bank_fields_error: 'Please fill in all bank transfer fields',
  invoice_gen_paypal_error: 'Please enter your PayPal email',
  invoice_gen_revtag_error: 'Please enter your Revtag',
  invoice_gen_stripe_link_error: 'Please enter your Stripe payment link',
  invoice_gen_stripe_error: 'Error creating Stripe link. Invoice will be generated without it.',
  invoice_gen_payment_server_error: 'Unable to reach the payment server.',
  invoice_gen_validated_toast: 'Invoice validated and downloaded!',
  invoice_gen_validation_error: 'An error occurred during validation.',
  // ─── CRM Integration Modal ───
  crm_integration_title: 'CRM Integration',
  crm_integration_subtitle: 'Choose and configure your CRM to sync your data.',
  crm_integration_available: 'Available Integrations',
  crm_integration_connected_label: 'Connected',
  crm_integration_builtin_crm: 'Built-in CRM',
  crm_integration_builtin_desc: 'The native CloseOS CRM is enabled by default. No configuration needed.',
  crm_integration_webhook_url: 'Webhook URL',
  crm_integration_webhook_paste: "Paste this URL in iClosed \u2192 Settings \u2192 Developer \u2192 Webhooks",
  crm_integration_connection: 'Connection',
  crm_integration_connect_desc: 'Connect your account to automatically sync your contacts.',
  crm_integration_sync_status: 'Sync Status',
  crm_integration_auto_sync: 'Auto-sync runs every 2 minutes.',
  crm_integration_sync_now: 'Sync now',
  crm_integration_disconnect: 'Disconnect',
  crm_integration_contacts_imported: 'contacts imported',
  crm_integration_deals_imported: 'deals imported',
  crm_integration_records_imported: 'records imported',
  crm_integration_updated: 'updated',
  crm_integration_stage_changes_auto: 'Stage changes are pushed automatically.',
  crm_integration_stage_mapping: 'Stage Mapping',
  crm_integration_select_stage: 'Select a stage',
  crm_integration_loading: 'Loading...',
  crm_integration_api_key_label: 'API Key',
  crm_integration_paste_api_key: 'Paste your API key here',
  crm_integration_save_key: 'Save',
  crm_integration_instructions: 'Integration instructions',
  crm_integration_generate_api_key: 'Generate API key',
  crm_integration_generate_btn: 'Generate API key',
  crm_integration_delete_key: 'Delete key',
  crm_integration_airtable_config: 'Airtable Configuration',
  crm_integration_base: 'Base',
  crm_integration_table: 'Table',
  crm_integration_select: 'Select',
  crm_integration_field_mapping: 'Field Mapping',
  crm_integration_not_mapped: '\u2014 Not mapped \u2014',
  crm_integration_stage_mapping_label: 'Stage Mapping',
  crm_integration_save_config: 'Save configuration',
  crm_integration_saving: 'Saving...',
  crm_integration_pipeline_mapping: 'Pipeline & Mapping',
  crm_integration_select_pipeline: 'Select a pipeline',
  crm_integration_csv_export_title: 'Export CRM',
  crm_integration_csv_export_desc: 'Download all your prospects as CSV',
  crm_integration_csv_export_btn: 'Export as CSV',
  crm_integration_csv_import_title: 'Import prospects',
  crm_integration_csv_import_desc: 'Import a CSV file to create prospects in your CRM.',
  crm_integration_csv_importing: 'Importing...',
  crm_integration_csv_choose_file: 'Choose a CSV file',
  crm_integration_csv_imported: 'prospects imported',
  crm_integration_csv_skipped: 'lines skipped (missing data)',
  crm_integration_csv_defaulted: 'unrecognized statuses \u2192 set to "Prospect"',
  crm_integration_csv_warning: 'Unrecognized statuses will be automatically assigned to "Prospect". Prefer using exact statuses:',
  crm_integration_csv_format_title: 'Expected CSV format',
  crm_integration_csv_col: 'Column',
  crm_integration_csv_required: 'Required',
  crm_integration_csv_example: 'Example',
  crm_integration_csv_yes: 'Yes',
  crm_integration_csv_no: 'No',
  crm_integration_csv_note: 'Columns are auto-detected by their headers.',
  crm_integration_csv_separator: 'Separator: comma or semicolon.',
  crm_integration_csv_ai_title: 'Your CSV is not in the right format?',
  crm_integration_csv_ai_desc: 'Copy this prompt into ChatGPT with your file:',
  crm_integration_close_btn: 'Close',
  crm_integration_save_btn: 'Save',
  crm_integration_saving_btn: 'Saving...',
  crm_integration_firstname: 'First name',
  crm_integration_lastname: 'Last name',
  crm_integration_email_field: 'Email',
  crm_integration_phone_field: 'Phone',
  crm_integration_company_field: 'Company',
  crm_integration_stage_field: 'Stage',
  crm_integration_value_field: 'Value',
  closer_calldetails_objection_think: 'I need to think about it', closer_calldetails_objection_budget: 'Money/budget', closer_calldetails_objection_discuss: 'Need to discuss', closer_calldetails_objection_timing: 'Not the right time', closer_calldetails_objection_fear: 'Fear', closer_calldetails_objection_smokescreen: 'Smokescreen', closer_calldetails_objection_other: 'Other',
  closer_calldetails_outcome_won: 'Won', closer_calldetails_outcome_followup: 'Follow up', closer_calldetails_outcome_lost: 'Lost', closer_calldetails_outcome_noshow: 'No Show',
  closer_calldetails_setter_qualified: 'Qualified', closer_calldetails_setter_booklater: 'Book later', closer_calldetails_setter_unqualified: 'Unqualified', closer_calldetails_setter_noanswer: 'No Answer',
  closer_calldetails_not_found: 'Call not found', closer_calldetails_back_to_calls: 'Back to calls', closer_calldetails_back: 'Back', closer_calldetails_readonly_banner: 'View mode — This call has already been qualified',
  closer_calldetails_title_readonly: 'Call details with', closer_calldetails_title_settercloser: 'Call summary with', closer_calldetails_title_closer: 'Sales summary with',
  closer_calldetails_linked_offer: 'Linked offer', closer_calldetails_no_linked_offer: 'No offer linked to this prospect',
  closer_calldetails_tab_qualification: 'Qualification', closer_calldetails_tab_notes: 'Call notes', closer_calldetails_tab_reminder: 'Schedule a reminder',
  closer_calldetails_outcome_label_closer: 'Call outcome — Closer', closer_calldetails_outcome_label_setter: 'Call outcome — Setter',
  closer_calldetails_sale_details: 'Sale details', closer_calldetails_sale_amount: 'Sale amount', closer_calldetails_payment_mode: 'Payment method', closer_calldetails_payment_cash: 'One-time', closer_calldetails_payment_installments: 'Installments',
  closer_calldetails_installments_count: 'Number of installments', closer_calldetails_months: 'months', closer_calldetails_amount_per_month: 'Amount per month:',
  closer_calldetails_your_commission: 'Your Commission', closer_calldetails_you_will_receive: 'You will receive:', closer_calldetails_commission_rate: 'Commission rate:',
  closer_calldetails_stripe_linked: 'Stripe subscription linked', closer_calldetails_stripe_amount: 'Amount', closer_calldetails_stripe_status: 'Status', closer_calldetails_stripe_active: 'Active', closer_calldetails_stripe_late: 'Past due', closer_calldetails_stripe_canceled: 'Canceled', closer_calldetails_stripe_month: 'month', closer_calldetails_stripe_year: 'year',
  closer_calldetails_stripe_link: 'Link to Stripe', closer_calldetails_stripe_auto: 'Auto', closer_calldetails_stripe_search: 'Search', closer_calldetails_stripe_manual: 'Manual',
  closer_calldetails_stripe_auto_desc: 'Automatic search for a Stripe subscription linked to email', closer_calldetails_stripe_not_found: 'No Stripe subscription found for this email. Try search or manual entry.', closer_calldetails_stripe_search_auto: 'Search automatically',
  closer_calldetails_stripe_email_placeholder: 'Stripe customer email', closer_calldetails_stripe_no_customer: 'No Stripe customer found.', closer_calldetails_stripe_no_subscription: 'No subscription',
  closer_calldetails_stripe_customer_id: 'Stripe Customer ID', closer_calldetails_stripe_subscription_id: 'Stripe Subscription ID', closer_calldetails_stripe_link_btn: 'Link this subscription',
  closer_calldetails_followup_title: 'Follow-up information', closer_calldetails_followup_date: 'Reschedule date', closer_calldetails_followup_reason: 'Postponement reason', closer_calldetails_followup_select: 'Select a reason', closer_calldetails_followup_specify: 'Specify the reason',
  closer_calldetails_lost_title: 'Loss reason', closer_calldetails_lost_reason: 'Reason', closer_calldetails_lost_details: 'Details', closer_calldetails_lost_details_placeholder: 'Specify the details...',
  closer_calldetails_auto_assign_self: 'The prospect will be automatically assigned to you as a Closer.',
  closer_calldetails_step1_assign: 'Step 1 — Assign a Closer', closer_calldetails_no_closer: 'No closer in the team', closer_calldetails_select_manually: 'Select manually', closer_calldetails_choose_closer: '-- Choose a closer --',
  closer_calldetails_round_robin: 'Next (Round Robin)', closer_calldetails_random: 'Random', closer_calldetails_available: 'Available',
  closer_calldetails_step2_schedule: 'Step 2 — Schedule the appointment', closer_calldetails_loading_slots: 'Loading slots...', closer_calldetails_no_slots: 'No available slot for this closer in the next 14 days.', closer_calldetails_see_all_slots: 'See all slots', closer_calldetails_slot_confirmed: 'Appointment confirmed',
  closer_calldetails_no_prospect: 'No linked prospect', closer_calldetails_create_prospect_desc: 'Create a prospect to qualify this call', closer_calldetails_label_name: 'Name', closer_calldetails_label_email: 'Email', closer_calldetails_label_phone: 'Phone', closer_calldetails_label_company: 'Company', closer_calldetails_creating: 'Creating...', closer_calldetails_create_prospect: 'Create prospect',
  closer_calldetails_notes_label: 'Call history and notes', closer_calldetails_notes_placeholder: 'Take your notes here. They will be saved in the call history...', closer_calldetails_notes_info: "These notes will be added to the prospect's call history.",
  closer_calldetails_reminder_title: 'Schedule a reminder', closer_calldetails_reminder_label_title: 'Title', closer_calldetails_reminder_label_desc: 'Description', closer_calldetails_reminder_optional: '(optional)', closer_calldetails_reminder_label_date: 'Date', closer_calldetails_reminder_label_time: 'Time', closer_calldetails_reminder_saving: 'Saving...', closer_calldetails_reminder_save: 'Save reminder',
  closer_calldetails_cancel: 'Cancel', closer_calldetails_saving: 'Saving...', closer_calldetails_save_all: 'Save All',
  closer_calldetails_toast_saved: 'Saved', closer_calldetails_toast_save_error: 'Error while saving', closer_calldetails_toast_reminder_saved: 'Reminder scheduled', closer_calldetails_toast_reminder_error: 'Error creating reminder', closer_calldetails_toast_no_closer: 'No closer available', closer_calldetails_toast_slots_error: 'Error loading slots', closer_calldetails_toast_prospect_created: 'Prospect created and linked to call', closer_calldetails_toast_prospect_error: 'Error creating prospect',
  closer_calldetails_toast_stripe_auto: 'Stripe subscription linked automatically', closer_calldetails_toast_stripe_success: 'Stripe subscription linked successfully', closer_calldetails_toast_stripe_fail: 'Unable to link subscription', closer_calldetails_toast_stripe_error: 'Stripe linking error', closer_calldetails_toast_stripe_manual: 'Stripe subscription linked manually',
  closer_calldetails_company_placeholder: 'Company name', closer_calldetails_reminder_title_placeholder: 'Ex: Call back Jean about the contract', closer_calldetails_reminder_desc_placeholder: 'Additional details...', closer_calldetails_followup_other_placeholder: 'Ex: Exceptional unavailability...',
  closer_calldetails_at: 'at',
  setter_calldetails_not_found: 'Call not found', setter_calldetails_back_to_calls: 'Back to calls', setter_calldetails_back: 'Back', setter_calldetails_readonly_banner: 'View mode — This call has already been qualified',
  setter_calldetails_title_readonly: 'Call details with', setter_calldetails_title_default: 'Qualify your call with',
  setter_calldetails_tab_qualification: 'Qualification', setter_calldetails_tab_notes: 'Call notes', setter_calldetails_tab_reminder: 'Schedule a reminder',
  setter_calldetails_outcome_label: 'Call outcome', setter_calldetails_outcome_qualified: 'Qualified', setter_calldetails_outcome_booklater: 'Book later', setter_calldetails_outcome_unqualified: 'Unqualified', setter_calldetails_outcome_noanswer: 'No Answer',
  setter_calldetails_step1_assign: 'Step 1 — Assign a Closer', setter_calldetails_no_closer: 'No closer in the team', setter_calldetails_select_manually: 'Select manually', setter_calldetails_choose_closer: '— Choose a closer —',
  setter_calldetails_round_robin: 'Next (Round Robin)', setter_calldetails_random: 'Random', setter_calldetails_available: 'Available',
  setter_calldetails_step2_schedule: 'Step 2 — Schedule the appointment', setter_calldetails_loading_slots: 'Loading slots...', setter_calldetails_no_slots: 'No available slot for this closer in the next 14 days.', setter_calldetails_see_all_slots: 'See all slots', setter_calldetails_slot_confirmed: 'Appointment confirmed',
  setter_calldetails_notes_label: 'Call history and notes', setter_calldetails_notes_placeholder: 'Take your notes here. They will be saved in the call history...', setter_calldetails_notes_info: "These notes will be added to the prospect's call history.",
  setter_calldetails_reminder_title: 'Schedule a reminder', setter_calldetails_reminder_label_title: 'Title', setter_calldetails_reminder_label_desc: 'Description', setter_calldetails_reminder_optional: '(optional)', setter_calldetails_reminder_label_date: 'Date', setter_calldetails_reminder_label_time: 'Time', setter_calldetails_reminder_saving: 'Saving...', setter_calldetails_reminder_save: 'Save reminder',
  setter_calldetails_cancel: 'Cancel', setter_calldetails_saving: 'Saving...', setter_calldetails_save_all: 'Save All',
  setter_calldetails_toast_saved: 'Saved', setter_calldetails_toast_save_error: 'Error while saving', setter_calldetails_toast_reminder_saved: 'Reminder scheduled', setter_calldetails_toast_reminder_error: 'Error creating reminder', setter_calldetails_toast_no_closer: 'No closer available', setter_calldetails_toast_slots_error: 'Error loading slots',
  setter_calldetails_reminder_title_placeholder: 'Ex: Call back Jean about the contract', setter_calldetails_reminder_desc_placeholder: 'Additional details...',
  setter_calldetails_at: 'at',
  closer_agenda_day_mon: 'Mon', closer_agenda_day_tue: 'Tue', closer_agenda_day_wed: 'Wed', closer_agenda_day_thu: 'Thu', closer_agenda_day_fri: 'Fri', closer_agenda_day_sat: 'Sat', closer_agenda_day_sun: 'Sun',
  closer_agenda_status_pending: 'Pending', closer_agenda_status_confirmed: 'Confirmed', closer_agenda_status_cancelled: 'Cancelled', closer_agenda_status_done: 'Done',
  closer_agenda_today: 'Today', closer_agenda_view_day: 'Day', closer_agenda_view_week: 'Week', closer_agenda_view_month: 'Month',
  closer_agenda_new: 'New', closer_agenda_loading: 'Loading...', closer_agenda_google_connected: 'Google connected', closer_agenda_google_sync: 'Sync Google',
  closer_agenda_my_agenda: 'My agenda', closer_agenda_all_members: 'All members',
  closer_agenda_all_day: 'All day', closer_agenda_appointment_default: 'Appointment', closer_agenda_reminder_label: 'Reminder',
  closer_agenda_reminder_done: 'Done', closer_agenda_reminder_overdue: 'Overdue', closer_agenda_reminder_upcoming: 'Upcoming',
  closer_agenda_join_meet: 'Join Google Meet', closer_agenda_link_copied: 'Link copied', closer_agenda_delete: 'Delete',
  closer_agenda_confirm_delete_event: 'Delete this event?', closer_agenda_event_deleted: 'Event deleted', closer_agenda_delete_error: 'Error deleting',
  closer_agenda_confirm_delete_reminder: 'Delete this reminder?', closer_agenda_reminder_deleted: 'Reminder deleted',
  closer_agenda_confirm_delete_google: 'Delete this Google Calendar event?', closer_agenda_google_deleted: 'Google Calendar event deleted',
  closer_agenda_new_event: 'New event', closer_agenda_label_title: 'Title', closer_agenda_title_placeholder: 'Ex: Discovery call, Weekly review...',
  closer_agenda_date_time: 'Date & Time', closer_agenda_all_day_toggle: 'All day',
  closer_agenda_assign_to: 'Assign to', closer_agenda_not_assigned: 'Unassigned', closer_agenda_assign_desc: 'Choose a team member for this appointment',
  closer_agenda_link_prospect: 'Linked to a prospect', closer_agenda_search_prospect: 'Search a prospect...', closer_agenda_no_name: 'No name', closer_agenda_no_prospect_found: 'No prospect found',
  closer_agenda_create_meet: 'Create a Google Meet', closer_agenda_notes_optional: 'Notes (optional)', closer_agenda_notes_placeholder: 'Add notes...',
  closer_agenda_cancel: 'Cancel', closer_agenda_create: 'Create',
  closer_agenda_choose_date: 'Choose a date', closer_agenda_event_created_meet: 'Event created with Google Meet', closer_agenda_prospect_updated: 'Prospect updated', closer_agenda_prospect_deleted: 'Prospect deleted',
  closer_agenda_all_day_suffix: ', all day', closer_agenda_from_to: ', from {start} to {end}', closer_agenda_day_label: 'Full day', closer_agenda_notes_section: 'Notes',
  closer_agenda_time_to: 'to',
  closer_agenda_booking_badge: 'Booking', closer_agenda_call_fallback: 'Call', closer_agenda_copy_link: 'Copy link',
};
