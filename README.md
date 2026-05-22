# 📌 Event Manager Backend

A scalable and secure backend application built using **Node.js, Express.js, and MongoDB** for managing events in colleges, clubs, communities, or organizations.

This project supports authentication, role-based access control, event management, event registration, filtering, searching, and admin controls with a clean modular architecture.

---

# 🚀 Features

## 🔐 Authentication & Security
- JWT-based Authentication
- Secure Password Hashing using bcrypt
- Protected Routes with Middleware
- Role-Based Authorization

---

## 👤 User Roles

### 🛠️ Admin
- Create Events
- Update Events
- Delete Events
- View Event Registrations
- Manage All Events

### 🙋 User
- Register/Login
- View Events
- Search & Filter Events
- Register for Events
- Prevent Duplicate Registrations

---

# 🎯 Event Features

Each event contains:

- Title
- Description
- Event Type
- Date & Time
- Registration Deadline
- Location

### 📂 Supported Event Types
- Hackathon
- Technical
- Seminar
- Games
- Movie
- Other

---

# 🔎 Search, Filter & Sorting

✔️ Filter events by category  
✔️ Search events by title  
✔️ Sort by nearest registration deadline

---

# ⚙️ Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | Backend Runtime |
| Express.js | Server Framework |
| MongoDB | Database |
| Mongoose | ODM |
| JWT | Authentication |
| bcrypt | Password Hashing |
| express-validator | Validation |
| dotenv | Environment Variables |

---

# 🧱 System Architecture

```text
                ┌────────────────────┐
                │      Client        │
                │ (Frontend / API)   │
                └─────────┬──────────┘
                          │
                          ▼
                ┌────────────────────┐
                │   Express Server   │
                │   (Routes Layer)   │
                └─────────┬──────────┘
                          │
          ┌───────────────┼────────────────┐
          ▼               ▼                ▼
 ┌────────────────┐ ┌──────────────┐ ┌──────────────┐
 │ Authentication │ │ Event Module │ │ Registration │
 │ JWT + bcrypt   │ │ CRUD Events  │ │ Event Signup │
 └────────────────┘ └──────────────┘ └──────────────┘
          │               │                │
          └───────────────┼────────────────┘
                          ▼
                ┌────────────────────┐
                │     Middleware     │
                │ Auth • Roles • API │
                └─────────┬──────────┘
                          ▼
                ┌────────────────────┐
                │      MongoDB       │
                │     + Mongoose     │
                └────────────────────┘
