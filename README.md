# Prenaya — Children's Craft Kit Store

> Made with love for *little creators* 🎨

Prenaya is a static e-commerce website for selling DIY craft kits for children. Orders are placed via WhatsApp — there is no traditional payment gateway. The frontend is pure HTML + CSS + Vanilla JS, and the backend is [Supabase](https://supabase.com/) (hosted Postgres + Auth + Storage).

---

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Database Schema](#database-schema)
- [Getting Started](#getting-started)
  - [1. Supabase Setup](#1-supabase-setup)
  - [2. Configure the Site](#2-configure-the-site)
  - [3. Create Your Admin User](#3-create-your-admin-user)
  - [4. Run Locally](#4-run-locally)
- [Pages Overview](#pages-overview)
- [Admin Panel](#admin-panel)
- [Key Design Decisions](#key-design-decisions)
- [Deployment](#deployment)

---

## Features

**Customer Site**
- Home page with category grid and featured products
- Catalog with category filter bar (URL-based, shareable)
- Product detail page with:
  - Image gallery (desktop thumbnail strip + mobile swipe carousel)
  - Variant selectors (e.g. Type × Keychain) with per-variant pricing
  - Colour selection (customer picks exactly N colours from the admin's palette)
  - Compare-at (strikethrough) pricing with discount % badge
- localStorage-based basket with composite keys (product + variant + colour set)
- Three-screen checkout: form → WhatsApp redirect → confirmation
- Floating WhatsApp + Instagram FAB on every page
- Mobile-responsive, mobile-first design
- bfcache-aware (basket badge syncs on browser back/forward)

**Admin Panel** (`/admin/`)
- Secure login via Supabase Auth (email + password)
- 60-minute inactivity auto-logout
- Product management: add / edit / delete / toggle stock
- Product image upload with drag-and-drop reorder, set-as-thumbnail, and WebP optimisation (client-side, no server cost)
- Variant system: define option groups (e.g. "Type", "Keychain") → auto-generated pricing table
- Category management with images
- Master colour palette management (name + hex)

---

## Project Structure

```
prenaya-website/
├── index.html              # Home page
├── catalog.html            # All Kits listing page
├── product.html            # Product detail page (?id=slug)
├── basket.html             # Basket / cart page
├── checkout.html           # Checkout flow (3-screen WhatsApp flow)
├── about.html              # About Us (static)
├── contact.html            # Contact Us (static)
│
├── css/
│   ├── styles.css          # All customer-facing styles (design tokens + components)
│   └── admin.css           # Admin panel styles
│
├── js/
│   ├── supabase-config.js  # Supabase client, PRENAYA_CONFIG, shared helpers
│   ├── basket.js           # localStorage basket API (no DOM)
│   ├── header.js           # Shared header/footer/trust bar/FABs/toast/qty stepper
│   ├── home.js             # Home page: categories + featured products
│   ├── catalog.js          # Catalog page: filter bar + product grid
│   ├── product.js          # Product detail: gallery, variants, colours, cart
│   ├── basket-page.js      # Basket page: render + qty/remove events
│   └── checkout.js         # Checkout: form validation + WhatsApp message builder
│
├── admin/
│   ├── index.html          # Admin login
│   ├── dashboard.html      # Product list
│   ├── product-form.html   # Add / edit product
│   ├── categories.html     # Category CRUD
│   ├── colors.html         # Colour palette CRUD
│   └── js/
│       ├── admin-auth.js       # Auth, session guard, inactivity logout, shared layout
│       ├── admin-dashboard.js  # Product list logic
│       ├── admin-product.js    # Product form logic (variants, colours, images)
│       ├── admin-categories.js # Category form logic
│       └── admin-colors.js     # Colour palette logic
│
├── images/
│   └── site/
│       ├── prenaya-logo.png
│       └── hero-image.png
│
└── supabase/
    ├── setup.sql               # Core schema (run first)
    ├── add-product-variants.sql # Variant system migration (run second)
    ├── add-compare-at-price.sql # Compare-at price migration
    ├── add-category-image.sql   # Category image migration
    ├── add-product-colors.sql   # Colour selection migration (run last)
    └── fix-permissions.sql      # Permissions patch
```

### Script Load Order

Each HTML page loads scripts in this order (order matters — no bundler):

```html
<script src="js/supabase-config.js"></script>  <!-- Supabase client + config -->
<script src="js/basket.js"></script>            <!-- Basket API -->
<script src="js/header.js"></script>            <!-- Shared UI + qty stepper -->
<script src="js/[page-specific].js"></script>  <!-- e.g. home.js, catalog.js -->
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES6+) |
| Backend / DB | [Supabase](https://supabase.com/) (Postgres + RLS) |
| Auth | Supabase Auth (email + password, admin only) |
| Storage | Supabase Storage (`product-images` bucket, public) |
| Fonts | [Nunito](https://fonts.google.com/specimen/Nunito) via Google Fonts |
| Build tools | None — static files served as-is |

---

## Database Schema

SQL files in `/supabase/` must be run in the Supabase SQL Editor in this order:

1. `setup.sql` — core tables
2. `add-product-variants.sql` — variant system
3. `add-compare-at-price.sql` — strikethrough pricing
4. `add-category-image.sql` — category images
5. `add-product-colors.sql` — colour selection system
6. `fix-permissions.sql` — permissions patch (if needed)

### Core Tables

| Table | Purpose |
|---|---|
| `admin_users` | UUIDs of users allowed to manage the store. Write-protected — only editable via the SQL Editor. |
| `categories` | Product categories with name, slug, display order, and image. |
| `products` | Products with name, slug, price, description, age range, availability, featured flag, and colour count. |
| `product_images` | One or more images per product, ordered by `display_order`. First image is the thumbnail. |
| `product_options` | Option group per product (e.g. "Type", "Keychain"). |
| `product_option_values` | Values within an option group (e.g. "Normal", "Special"). |
| `product_variants` | Cartesian combinations of option values with individual pricing. Combination stored as `jsonb`. |
| `colors` | Master colour palette (name + hex). |
| `product_colors` | Which palette colours a product offers for customer selection. |

### Row Level Security

All tables have RLS enabled. The pattern is:
- **Public (anon role):** `SELECT` only, `USING (true)`.
- **Admin writes:** `INSERT / UPDATE / DELETE` gated by `is_admin()` — a `SECURITY DEFINER` function that checks `auth.uid()` against `admin_users`.

---

## Getting Started

### 1. Supabase Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. In **Dashboard → SQL Editor**, run each SQL file from the `/supabase/` folder in the order listed above.
3. In **Dashboard → Storage**, create a bucket:
   - Name: `product-images`
   - Public: **ON**
4. Add bucket policies manually (see comments at the bottom of `setup.sql`).
5. In **Dashboard → Authentication → Settings**, disable "Allow new users to sign up".

### 2. Configure the Site

Open `js/supabase-config.js` and update the two Supabase credentials:

```js
const SUPABASE_URL = 'YOUR_PROJECT_URL';
const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';
```

Find these in **Dashboard → Settings → API**.

Also update the business settings in the same file:

```js
const PRENAYA_CONFIG = {
  whatsappNumber: '91XXXXXXXXXX', // Country code + number, no spaces
  currency: '₹',
  siteName: 'Prenaya',
  // ...
};
```

### 3. Create Your Admin User

1. In **Dashboard → Authentication**, click **Add User** and create an account with your email + password.
2. Copy the UUID from the user row.
3. In **Dashboard → SQL Editor**, run:

```sql
INSERT INTO admin_users (user_id) VALUES ('YOUR-USER-UUID-HERE');
```

### 4. Run Locally

No build step required. Serve the root folder with any static file server:

```bash
# Python
python3 -m http.server 8080

# Node (npx)
npx serve .

# VS Code
# Use the "Live Server" extension
```

Then open `http://localhost:8080` in your browser.

Admin panel: `http://localhost:8080/admin/`

---

## Pages Overview

| Page | URL | Description |
|---|---|---|
| Home | `index.html` | Category grid + featured products |
| Catalog | `catalog.html` | Full product listing with category filter (`?category=slug`) |
| Product | `product.html` | Product detail (`?id=slug`) |
| Basket | `basket.html` | Cart contents |
| Checkout | `checkout.html` | 3-screen WhatsApp order flow |
| About | `about.html` | About Us (static) |
| Contact | `contact.html` | Contact Us (static) |

### Checkout Flow

1. Customer fills in name, phone (Indian format), split address, and optional notes.
2. On submit, a pre-formatted WhatsApp message is built and `wa.me/{number}?text=...` is opened in a new tab. A pending order is saved to `sessionStorage`.
3. The customer is asked "Did you send the message?" — **the basket is only cleared when they confirm Yes**.

---

## Admin Panel

Access at `/admin/`. Login with the email and password you created in Supabase Auth.

| Page | Path | Purpose |
|---|---|---|
| Login | `admin/index.html` | Email + password login |
| Products | `admin/dashboard.html` | List, search, filter, toggle stock, delete |
| Add / Edit Product | `admin/product-form.html` | Full product form |
| Categories | `admin/categories.html` | Create, edit, delete categories |
| Colour Palette | `admin/colors.html` | Manage the master colour palette |

### Product Form Features

- **Images:** Drag-and-drop upload (up to 8), drag-to-reorder, "Set as thumbnail" button. Images are automatically optimised to WebP (max 1200px, ~82% quality) in the browser before upload.
- **Variants:** Enable the variants toggle to define option groups (e.g. "Type: Normal / Special"). The table of all combinations is auto-generated, and you can set individual prices and stock status per variant.
- **Colour selection:** Enable the colours toggle, pick which palette colours this product offers, and set how many the customer must choose (e.g. 3 colours for a painting kit).
- **Compare-at price:** Set an MRP higher than the selling price to show a strikethrough and discount badge on the product page.

---

## Key Design Decisions

**No framework, no bundler.** All pages are plain HTML files with `<script>` tags. This keeps the project dependency-free and trivial to deploy anywhere — no `npm install`, no build step, no CI pipeline needed.

**WhatsApp as the order channel.** There is no payment gateway. The order message is formatted with WhatsApp markdown and opened via a `wa.me` deep link. This is intentional for the business model — low setup cost, direct customer communication.

**Composite basket keys.** A basket line is uniquely identified by `productId[::variantId][::colors:id1,id2,...]`. This means the same product with different colour selections are stored as separate lines, which is the intended behaviour for craft kits.

**Client-side image optimisation.** The admin's browser resizes and converts images to WebP before upload. This avoids any serverless function cost and keeps Supabase Storage bills low.

**Colour IDs sorted in the basket key.** When building the basket key for a colour product, the selected colour IDs are sorted alphabetically before joining. This ensures that selecting Red then Blue produces the same key as Blue then Red — no accidental duplicate lines.

---

## Deployment

The site is a set of static files with no server-side code. It can be hosted anywhere that serves static files:

- **GitHub Pages** — push to a `gh-pages` branch or configure Pages to serve from `main`.
- **Netlify / Vercel** — drag-and-drop the folder or connect the repository. No build command needed.
- **Any web host** — upload the files via FTP/SFTP.

The only runtime dependency is the Supabase project URL and anon key configured in `js/supabase-config.js`.
