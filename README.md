# ConWork - Enterprise Management Platform

ระบบบริหารจัดการองค์กร จัดการโปรเจกต์ งาน พนักงาน รายงาน และการเงิน (Enterprise Management Web Application)

---

## 🚀 การติดตั้งและเปิดใช้งาน (Getting Started)

### ความต้องการของระบบ:
- [Node.js](https://nodejs.org/) (เวอร์ชัน 18 ขึ้นไป) หรือเว็บเบราว์เซอร์สมัยใหม่ (Chrome, Edge, Firefox, Safari)

### คำสั่งเปิดรันเซิร์ฟเวอร์จำลองในเครื่อง (Local Development):
```bash
# รันเซิร์ฟเวอร์ dev (พอร์ต 3000)
npm run dev
```
จากนั้นเปิดเบราว์เซอร์ไปที่: `http://localhost:3000`

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```text
conwork-final/
├── index.html                 # หน้าหลักของระบบ (Main Application Page)
├── package.json               # คำสั่งรัน npm script (dev, start)
├── vercel.json                # การตั้งค่า Routing สำหรับ Vercel Deployment
├── .gitignore                 # กำหนดไฟล์ที่ไม่ต้องติดตามด้วย Git
├── .env.example               # ตัวอย่าง Environment Variables สำหรับเชื่อมต่อบริการ
├── README.md                  # เอกสารแนะนำโปรเจกต์
│
├── css/                       # ไฟล์ Stylesheet ของระบบ
│   ├── style.css              # สไตล์หลัก
│   ├── dark-mode.css          # สไตล์ธีมมืด (Dark Theme)
│   ├── login-flow.css         # สไตล์หน้าเข้าสู่ระบบและยืนยันตัวตน
│   └── work-report.css        # สไตล์หน้ารายงานการทำงาน
│
├── js/                        # สคริปต์ JavaScript หลัก
│   ├── app.js                 # ควบคุม Flow และ UI หลักของแอปพลิเคชัน
│   ├── apiService.js          # จัดการการเชื่อมต่อ API
│   ├── config.js              # ค่าคอนฟิกและการตั้งค่าเบื้องต้น
│   ├── finance.js             # จัดการระบบการเงินและค่าใช้จ่าย
│   ├── i18n.js                # รองรับหลายภาษา (Localization)
│   ├── login-flow.js          # จัดการ Authentication และ Login
│   ├── mockData.js            # ข้อมูลจำลองสำหรับทดสอบ
│   ├── supabaseClient.js      # ตัวเชื่อมต่อฐานข้อมูล Supabase
│   └── workReport.js          # จัดการระบบรายงานผลการปฏิบัติงาน
│
├── img/                       # รูปภาพและโลโก้
│   └── logo.jpg
│
├── supabase/                  # ฐานข้อมูล Supabase (BaaS Primary Backend)
│   └── schema.sql             # SQL Schema ล่าสุดสำหรับตาราง ฟังก์ชัน และ RLS
│
├── docs/                      # เอกสารคู่มือและข้อกำหนด (TOR & Documentation)
│   ├── TOR_WebApp_ConWork.md
│   ├── TOR_GentleCare_GentleMoss.md
│   ├── TOR_GentleCare_GentleMoss.html
│   └── supabase_setup.md
│
├── data/                      # ไฟล์ข้อมูล JSON
│   ├── data.json              # ข้อมูลผู้ใช้และแผนกเดิม
│   ├── phrases.json           # คลังคำศัพท์ที่สกัดไว้สำหรับภาษา
│   └── reportConfig.json      # ค่าคอนฟิกรายงาน
│
├── scripts/                   # สคริปต์เครื่องมือสำหรับพัฒนาระบบ
│   ├── add_dashboard.js       # สคริปต์เครื่องมือฉีดคอมโพเนนต์แดชบอร์ด
│   └── scratch.js             # สคริปต์สกัดคำศัพท์ไทยสำหรับ i18n
│
└── archive/                   # ไฟล์ต้นแบบเวอร์ชันแรกและไฟล์สำรอง
    ├── ConWork.html           # ไฟล์ HTML เวอร์ชันก่อนหน้า
    ├── conwork.js             # JavaScript ต้นแบบชุดแรก
    ├── conwork.css            # Stylesheet ต้นแบบชุดแรก
    ├── workReport_backup.js   # ไฟล์สำรองของ workReport.js
    └── legacy_php_api/        # ระบบ Backend เดิม (PHP & MySQL) ที่เลิกใช้งาน
        ├── db_connect.php
        ├── login.php
        ├── register.php
        └── database_schema.sql
```

---

## 🌐 การ Deploy
โปรเจกต์นี้รองรับการ Deploy ขึ้น Vercel ได้ทันที โดยมีการตั้งค่า Single Page Application Rewrite ผ่าน `vercel.json` เรียบร้อยแล้ว