# popflix-synchron 🎬✨

**Metadata Synchronization and Enrichment Service for PopFlix**

[![Node.js Version](https://img.shields.io/badge/Node.js-20+-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strongly%20Typed-blue)](https://www.typescriptlang.org/)
[![Database](https://img.shields.io/badge/Database-MySQL-orange)](https://www.mysql.com/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## 📖 Overview

`Synchronik` is a modular orchestration engine for contributor clarity and cognitive celebration. It transforms manual workflows into milestone-driven automation, letting your code coordinate tasks while you reclaim flow. With schema-aware batch handling, real-time overlays, and teachable subsystems.

It operates asynchronously to minimize latency and uses careful **rate-limiting** to adhere to third-party API usage policies. This ensures the PopFlix database is continuously synchronized with the latest poster images and official trailer URLs.

### 🎯 Key Features

* **TypeScript-First:** Built with TypeScript for strong typing, improved maintainability, and early error detection.
* **Incremental Batch Processing:** Selects and processes records in batches of 100 to manage memory and resource usage.
* **Resilient API Handling:** Uses `axios` to fetch data from The Movie Database (TMDB) using the IMDb ID (`tconst`) as a cross-reference key.
* **Rate Limiting:** Implements a controlled delay (`setTimeout`) between API calls to prevent throttling and service interruption.
* **Database Upsert Logic:** Utilizes SQL `ON DUPLICATE KEY UPDATE` logic for idempotent, reliable database operations.

---

## 🛠️ Technology Stack

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Runtime** | Node.js | Server-side JavaScript environment. |
| **Language** | TypeScript | Provides static type-checking and modern JS features. |
| **HTTP Client** | `axios` | Promise-based library for making external API calls to TMDB. |
| **Database** | MySQL | Stores the core IMDb data and the enriched `MediaLinks`. |
| **DB Client** | `mysql2` | High-performance, promise-based driver for MySQL. |
| **Configuration** | `dotenv` | Securely loads environment variables for secrets and keys. |
| **Tooling** | `ts-node` | Executes TypeScript files directly for rapid development. |

---

## 🚀 Getting Started

### Prerequisites

You will need the following installed:

1. **Node.js (LTS)**
2. **MySQL Server**
3. **TMDB API Key:** Register for a free Developer API key from [The Movie Database (TMDB)](https://www.themoviedb.org/documentation/api).

### Installation

1. **Clone the repository:**

    ```bash
    git clone [https://github.com/owen-6936/popflix-synchron.git](https://github.com/owen-6936/popflix-synchron.git)
    cd popflix-synchron
    ```

2. **Install dependencies:**

    ```bash
    npm install
    ```

### Configuration (`.env` file)

Create a file named **`.env`** in the root directory and add your secret keys and database credentials:

```bash

# Database Configuration

DB\_HOST=localhost
DB\_USER=root
DB\_PASSWORD=your\_secure\_password
DB\_NAME=popflix\_db

# External API Keys

TMDB\_API\_KEY=YOUR\_TMDB\_API\_KEY\_HERE

````

### Database Setup

1. Ensure you have run the initial IMDb core import into your database.
2. Execute the script to create the `MediaLinks` table (refer to the `create_media_links_table.sql` file):

```sql
CREATE TABLE IF NOT EXISTS MediaLinks (
    imdb_id VARCHAR(10) NOT NULL PRIMARY KEY,
    tmdb_id INT,
    poster_url VARCHAR(2048),
    trailer_embed_url VARCHAR(2048),
    processed_status ENUM('PENDING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'PENDING',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (imdb_id) REFERENCES TitleBasics(tconst)
);
````

### Running the Synchronizer

Use `ts-node` to execute the main synchronization script:

```bash
# Execute the service in development mode
npx ts-node synchronizer.ts
```

The service will begin fetching and updating in batches, pausing between each API call to respect rate limits.

---

That is an essential and often overlooked step, Owen\! A logical folder structure is the foundation of a professional, maintainable service like **`popflix-synchron`**. It will make navigating your TypeScript and configuration files much easier.

Based on your technology choices (Node.js, TypeScript, SWC), here is the recommended project structure:

---

## 📁 Recommended Folder Structure for `popflix-synchron`

This structure cleanly separates the source code (`src`) from configuration files and build outputs (`dist`).

```bash
popflix-synchron/
├── src/
│   ├── api/
│   │   └── tmdb_api.ts           <-- The core TMDB fetching logic (uses axios)
│   ├── config/
│   │   └── db.config.ts          <-- Database connection pool setup
│   ├── synchronizer.ts           <-- Main execution script (your loop, calls getNextBatch)
│   └── types/
│       └── tmdb.types.ts         <-- TypeScript interfaces for TMDB API responses
├── dist/                         <-- (Automatically generated by the 'build' script)
│   ├── api/
│   │   ├── tmdb_api.js
│   │   └── tmdb_api.d.ts
│   └── ...
├── .env                          <-- **(Required)** Stores your TMDB key and DB credentials
├── .gitignore                    <-- Ignores node_modules, .env, and dist
├── .swcrc                        <-- SWC compiler configuration
├── package.json                  <-- Project metadata and scripts
├── README.md                     <-- Your comprehensive documentation
└── tsconfig.json                 <-- TypeScript compiler configuration
```

### Key Rationale

1. **`src/`:** All your TypeScript source code lives here. This is the clean, high-level code that is easy to read and maintain.
2. **`src/api/`:** Dedicated folder for external service logic (like talking to the TMDB API).
3. **`src/config/`:** Dedicated folder for configuration that needs to be imported, like the database connection.
4. **`src/types/`:** A best practice in TypeScript. Place your shared interfaces and type definitions here (e.g., the structure of a `MediaLink` record or a TMDB movie object).
5. **`dist/`:** This is the *output* folder. You commit the source files, but you run the compiled files from here.
6. **`.env`:** Keeps sensitive information out of your source code. Make sure this file is in your `.gitignore`.

---

## 🤝 Contribution & License

This project is a personal development effort by **Owen**.

This project is licensed under the MIT License - see the [LICENSE](https://www.google.com/search?q=LICENSE) file for details.
