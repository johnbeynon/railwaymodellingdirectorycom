# Railway Modelling Events Website

A static website generator that displays railway modelling events from the [Railway Modelling Directory](https://github.com/johnbeynon/railwaymodellingdirectory).

## Features

- 🚂 Fetches event data from GitHub during build time
- 📱 Responsive design that works on all devices
- 🎨 Modern, clean UI with gradient header
- ⚡ Fast static HTML generation
- 🔧 Built with TypeScript

## Getting Started

### Prerequisites

- Node.js (v18 or higher)

### Installation

```bash
npm install
```

### Building the Site

```bash
npm run build
```

This will:
1. Fetch the latest events data from GitHub
2. Generate a static HTML file in the `dist/` directory

### Development

To build and serve the site locally:

```bash
npm run dev
```

Then open your browser to the URL shown (typically http://localhost:3000)

### Cleaning

To remove generated files:

```bash
npm run clean
```

## Project Structure

```
.
├── src/
│   ├── build.ts       # Main build script
│   └── types.ts       # TypeScript type definitions
├── dist/              # Generated static files (created on build)
├── package.json
├── tsconfig.json
└── README.md
```

## Deployment

The generated `dist/index.html` file can be deployed to any static hosting service:

- **GitHub Pages**: Push the `dist` folder contents
- **Netlify**: Connect your repo and set build command to `npm run build`
- **Vercel**: Similar to Netlify
- **Any web server**: Just upload the `dist/index.html` file

## Data Source

Events data is fetched from:
https://github.com/johnbeynon/railwaymodellingdirectory/blob/main/uk/events.json

## License

MIT
