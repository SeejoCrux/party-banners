import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = process.env.UPLOADS_PATH || path.join(__dirname, 'uploads');
const BANNERS_DIR = path.join(UPLOADS_DIR, 'banners');

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(BANNERS_DIR)) {
  fs.mkdirSync(BANNERS_DIR, { recursive: true });
}

/**
 * Escapes XML special characters for safe SVG rendering
 */
function escapeXml(unsafe) {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates an SVG name badge overlay
 */
function createNameBadgeSvg(width, height, userName) {
  const safeName = escapeXml(userName);
  const badgeHeight = Math.max(60, Math.floor(height * 0.16));
  const fontSize = Math.max(18, Math.floor(badgeHeight * 0.42));

  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0f172a" stop-opacity="0" />
          <stop offset="30%" stop-color="#0f172a" stop-opacity="0.75" />
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0.95" />
        </linearGradient>
        <filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.8"/>
        </filter>
      </defs>

      <!-- Gradient bottom overlay -->
      <rect x="0" y="${height - badgeHeight}" width="${width}" height="${badgeHeight}" fill="url(#badgeGrad)" />

      <!-- Accent line -->
      <rect x="0" y="${height - 4}" width="${width}" height="4" fill="#38bdf8" />

      <!-- Decorative tag pill -->
      <g transform="translate(16, ${height - badgeHeight + 14})">
        <rect width="${Math.min(width - 32, safeName.length * (fontSize * 0.65) + 32)}" height="${badgeHeight - 24}" rx="6" fill="#1e293b" fill-opacity="0.85" stroke="#475569" stroke-width="1.5"/>
        <circle cx="14" cy="${(badgeHeight - 24) / 2}" r="5" fill="#38bdf8" />
        <text
          x="28"
          y="${(badgeHeight - 24) / 2 + (fontSize * 0.35)}"
          font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          font-size="${fontSize}"
          font-weight="700"
          fill="#f8fafc"
          filter="url(#textShadow)"
        >${safeName}</text>
      </g>
    </svg>
  `);
}

/**
 * Process a single uploaded image: resize, crop, overlay name badge, and save
 */
export async function processUploadedImage(imageBuffer, userName) {
  const targetSize = 600; // 600x600 px high-res tile
  const filename = `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.png`;
  const outputPath = path.join(UPLOADS_DIR, filename);

  // 1. Resize and crop base image
  const baseImageBuffer = await sharp(imageBuffer)
    .resize(targetSize, targetSize, {
      fit: 'cover',
      position: 'center'
    })
    .toFormat('png')
    .toBuffer();

  // 2. Generate SVG Name Badge
  const svgBadge = createNameBadgeSvg(targetSize, targetSize, userName);

  // 3. Composite name badge onto image
  await sharp(baseImageBuffer)
    .composite([
      {
        input: svgBadge,
        top: 0,
        left: 0
      }
    ])
    .png({ quality: 90 })
    .toFile(outputPath);

  return {
    filename,
    relativePath: `/uploads/${filename}`,
    width: targetSize,
    height: targetSize
  };
}

/**
 * Creates a stitched composite banner / tapestry from multiple images
 */
export async function generateBannerTapestry(imageRecords, options = {}) {
  if (!imageRecords || imageRecords.length === 0) {
    throw new Error('No images available to generate a banner.');
  }

  const title = options.title || 'Community Tapestry';
  const tileWidth = 360;
  const tileHeight = 360;
  const gap = 12;
  const padding = 24;
  const headerHeight = 90;

  const count = imageRecords.length;

  // Compute grid layout (columns & rows)
  let cols = options.columns || (count === 1 ? 1 : count <= 4 ? 2 : count <= 9 ? 3 : count <= 16 ? 4 : 5);
  let rows = Math.ceil(count / cols);

  const bannerWidth = padding * 2 + cols * tileWidth + (cols - 1) * gap;
  const bannerHeight = padding * 2 + headerHeight + rows * tileHeight + (rows - 1) * gap;

  // Create Header & Canvas background SVG
  const safeTitle = escapeXml(title);
  const subtitle = escapeXml(`${count} Contribution${count > 1 ? 's' : ''} • Generated ${new Date().toLocaleDateString()}`);

  const backgroundSvg = Buffer.from(`
    <svg width="${bannerWidth}" height="${bannerHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#090d16" />
          <stop offset="50%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="#1e1b4b" />
        </linearGradient>
        <linearGradient id="titleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#38bdf8" />
          <stop offset="50%" stop-color="#818cf8" />
          <stop offset="100%" stop-color="#c084fc" />
        </linearGradient>
        <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#334155" stroke-width="0.75" stroke-opacity="0.3"/>
        </pattern>
      </defs>

      <!-- Background -->
      <rect width="${bannerWidth}" height="${bannerHeight}" fill="url(#bgGrad)" />
      <rect width="${bannerWidth}" height="${bannerHeight}" fill="url(#gridPattern)" />

      <!-- Header Section -->
      <g transform="translate(${padding}, ${padding})">
        <rect width="${bannerWidth - padding * 2}" height="${headerHeight - 16}" rx="12" fill="#1e293b" fill-opacity="0.7" stroke="#334155" stroke-width="1.5"/>
        <text x="24" y="42" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="800" fill="url(#titleGrad)">${safeTitle}</text>
        <text x="24" y="64" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="500" fill="#94a3b8">${subtitle}</text>
      </g>
    </svg>
  `);

  // Prepare tile composite inputs
  const compositeInputs = [
    {
      input: backgroundSvg,
      top: 0,
      left: 0
    }
  ];

  for (let i = 0; i < imageRecords.length; i++) {
    const record = imageRecords[i];
    const imagePath = path.join(UPLOADS_DIR, record.processed_filename);

    if (!fs.existsSync(imagePath)) {
      continue;
    }

    const colIndex = i % cols;
    const rowIndex = Math.floor(i / cols);

    const x = padding + colIndex * (tileWidth + gap);
    const y = padding + headerHeight + rowIndex * (tileHeight + gap);

    // Resize tile and round corners with sharp
    const roundedCornersSvg = Buffer.from(`
      <svg width="${tileWidth}" height="${tileHeight}">
        <rect x="0" y="0" width="${tileWidth}" height="${tileHeight}" rx="10" ry="10"/>
      </svg>
    `);

    const tileBuffer = await sharp(imagePath)
      .resize(tileWidth, tileHeight, { fit: 'cover' })
      .composite([{
        input: roundedCornersSvg,
        blend: 'dest-in'
      }])
      .png()
      .toBuffer();

    compositeInputs.push({
      input: tileBuffer,
      left: x,
      top: y
    });
  }

  const bannerFilename = `banner_${Date.now()}_${cols}x${rows}.png`;
  const bannerOutputPath = path.join(BANNERS_DIR, bannerFilename);

  // Generate blank base and composite all tiles onto it
  await sharp({
    create: {
      width: bannerWidth,
      height: bannerHeight,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 }
    }
  })
    .composite(compositeInputs)
    .png({ quality: 95 })
    .toFile(bannerOutputPath);

  return {
    filename: bannerFilename,
    relativePath: `/uploads/banners/${bannerFilename}`,
    imageCount: imageRecords.length,
    gridLayout: `${cols}x${rows}`,
    width: bannerWidth,
    height: bannerHeight
  };
}

/**
 * Automatically creates initial badged images and generates the initial tapestry banner for a Party.
 */
export async function createInitialPartyImagesAndBanner(party, adminUser, dbQueries) {
  if (!party || !dbQueries) return null;

  try {
    const existingImages = dbQueries.getPartyImages.all(party.id);
    const userName = adminUser?.name || 'Party Host';
    const userId = adminUser?.id || 1;

    // If no active images exist in DB for this party yet, create initial image tiles from hero & gallery images
    if (!existingImages || existingImages.length === 0) {
      const itemsToProcess = [];
      if (party.hero_image) {
        itemsToProcess.push({ url: party.hero_image, label: `${party.name} Hero` });
      }

      let parsedGallery = [];
      if (typeof party.gallery_images === 'string') {
        try { parsedGallery = JSON.parse(party.gallery_images); } catch (e) { parsedGallery = []; }
      } else if (Array.isArray(party.gallery_images)) {
        parsedGallery = party.gallery_images;
      }

      parsedGallery.forEach((gUrl, idx) => {
        if (gUrl && typeof gUrl === 'string') {
          itemsToProcess.push({ url: gUrl, label: `${party.name} #${idx + 1}` });
        }
      });

      for (const item of itemsToProcess) {
        try {
          let imageBuffer = null;
          if (item.url.startsWith('/uploads/')) {
            const localPath = path.join(UPLOADS_DIR, item.url.replace('/uploads/', ''));
            if (fs.existsSync(localPath)) {
              imageBuffer = fs.readFileSync(localPath);
            }
          } else if (item.url.startsWith('http://') || item.url.startsWith('https://')) {
            const fetchRes = await fetch(item.url);
            if (fetchRes.ok) {
              const arrayBuf = await fetchRes.arrayBuffer();
              imageBuffer = Buffer.from(arrayBuf);
            }
          }

          if (!imageBuffer) {
            // Generate synthetic gradient tile
            imageBuffer = await sharp({
              create: {
                width: 600,
                height: 600,
                channels: 4,
                background: { r: 15, g: 23, b: 42, alpha: 1 }
              }
            }).png().toBuffer();
          }

          const processed = await processUploadedImage(imageBuffer, item.label || userName);
          dbQueries.insertImage.run({
            party_id: party.id,
            user_id: userId,
            user_name: item.label || userName,
            original_filename: 'hero_image.png',
            processed_filename: processed.filename
          });
        } catch (err) {
          console.error('Initial party image processing error:', err);
        }
      }
    }

    // Generate banner tapestry from all available party images
    const recentImages = dbQueries.getRecentPartyImages.all(party.id, 24);
    if (recentImages && recentImages.length > 0) {
      const bannerTitle = party.tapestry_title || `${party.name} Tapestry`;
      const bannerResult = await generateBannerTapestry(recentImages, { title: bannerTitle });
      
      const insertResult = dbQueries.insertBanner.run({
        party_id: party.id,
        filename: bannerResult.filename,
        title: bannerTitle,
        image_count: bannerResult.imageCount,
        grid_layout: bannerResult.gridLayout
      });

      return {
        id: insertResult.lastInsertRowid,
        party_id: party.id,
        filename: bannerResult.filename,
        title: bannerTitle,
        image_count: bannerResult.imageCount,
        grid_layout: bannerResult.gridLayout,
        url: bannerResult.relativePath
      };
    }
  } catch (err) {
    console.error('createInitialPartyImagesAndBanner error:', err);
  }
  return null;
}
