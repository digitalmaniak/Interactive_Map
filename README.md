# Interactive Spatial Journal

An interactive cyberpunk-inspired map of the world built using **Next.js**, **Three.js**, and **Firebase (Firestore/Storage)**.

## Project Structure

- `_docs/`: Design and tech specification documents (Local only, ignored in Git).
- `_images/`: Visual design reference images (Local only, ignored in Git).
- `src/app/`: Next.js page routing and layout structure.
- `src/components/`: Core interactive components (including Three.js canvases).

## Tech Stack
- **Framework:** Next.js (App Router, JavaScript)
- **3D Graphics:** Three.js (via raw WebGL context rendering and custom canvas interaction)
- **Database & Auth:** Cloud Firestore, Firebase Storage
- **Styling:** Vanilla CSS (cyberpunk palette: `#020617`, `#f43f5e`, `#38bdf8`, `#1a0210`)

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Development
1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the development server:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) in your browser.
