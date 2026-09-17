// js/config.js
const CONFIG = {
    // ตั้งค่า Environment: 'development', 'staging', 'production'
    ENV: 'development',

    // ตั้งค่าเวลา Timeout ของการเชื่อมต่อ (หน่วยเป็นมิลลิวินาที)
    TIMEOUT: 10000,

    // ตั้งค่า Prefix สำหรับคีย์ต่างๆ ใน LocalStorage เพื่อป้องกันการชนกัน
    STORAGE_PREFIX: 'conwork_',

    // ตั้งค่า Supabase BaaS Backend Integration (Primary Backend)
    USE_SUPABASE: true,
    SUPABASE_URL: 'https://kxgoodsgrdxfexntqkce.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_YGH9kOuopS71l_oqQxvqCw_kTJdviBe'
};

window.CONWORK_CONFIG = CONFIG;

