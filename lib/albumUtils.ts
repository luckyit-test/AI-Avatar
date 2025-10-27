/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// Helper function to load an image and return it as an HTMLImageElement
function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(new Error(`Failed to load image: ${src.substring(0, 50)}...`));
        img.src = src;
    });
}

/**
 * Creates a single "photo album" page image from a collection of style images.
 * @param imageData A record mapping style strings to their image data URLs.
 * @returns A promise that resolves to a data URL of the generated album page (JPEG format).
 */
export async function createAlbumPage(imageData: Record<string, string>): Promise<string> {
    const canvas = document.createElement('canvas');
    const canvasWidth = 2480;
    const canvasHeight = 3508;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Could not get 2D canvas context');
    }

    // 1. Draw the clean background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 2. Draw the title
    ctx.fillStyle = '#111827'; // a dark gray
    ctx.textAlign = 'center';

    ctx.font = `bold 90px 'Inter', sans-serif`;
    ctx.fillText('Ваши AI Бизнес-Портреты', canvasWidth / 2, 180);

    ctx.font = `50px 'Inter', sans-serif`;
    ctx.fillStyle = '#4b5563'; // a medium gray
    ctx.fillText('Создано в Google AI Studio', canvasWidth / 2, 260);

    // 3. Load all the images concurrently
    const styles = Object.keys(imageData);
    const loadedImages = await Promise.all(
        Object.values(imageData).map(url => loadImage(url))
    );

    const imagesWithStyles = styles.map((style, index) => ({
        style,
        img: loadedImages[index],
    }));

    // 4. Define grid layout and draw each image card
    const grid = { cols: 2, rows: 3, padding: 120 };
    const contentTopMargin = 400;
    const contentWidth = canvasWidth - grid.padding * 2;
    const contentHeight = canvasHeight - contentTopMargin - grid.padding;
    const cellWidth = (contentWidth - grid.padding * (grid.cols - 1)) / grid.cols;
    const cellHeight = (contentHeight - grid.padding * (grid.rows - 1)) / grid.rows;

    imagesWithStyles.forEach(({ style, img }, index) => {
        const row = Math.floor(index / grid.cols);
        const col = index % grid.cols;

        const x = grid.padding + col * (cellWidth + grid.padding);
        const y = contentTopMargin + row * (cellHeight + grid.padding);
        
        ctx.save();
        
        // Draw a soft shadow for depth
        ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
        ctx.shadowBlur = 40;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 10;
        
        // Draw the white card background
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        const cornerRadius = 24;
        ctx.moveTo(x + cornerRadius, y);
        ctx.lineTo(x + cellWidth - cornerRadius, y);
        ctx.arcTo(x + cellWidth, y, x + cellWidth, y + cornerRadius, cornerRadius);
        ctx.lineTo(x + cellWidth, y + cellHeight - cornerRadius);
        ctx.arcTo(x + cellWidth, y + cellHeight, x + cellWidth - cornerRadius, y + cellHeight, cornerRadius);
        ctx.lineTo(x + cornerRadius, y + cellHeight);
        ctx.arcTo(x, y + cellHeight, x, y + cellHeight - cornerRadius, cornerRadius);
        ctx.lineTo(x, y + cornerRadius);
        ctx.arcTo(x, y, x + cornerRadius, y, cornerRadius);
        ctx.closePath();
        ctx.fill();

        // Remove shadow for subsequent drawing
        ctx.shadowColor = 'transparent';

        // Define image area inside the card
        const imagePadding = 40;
        const imageAreaWidth = cellWidth - imagePadding * 2;
        const imageAreaHeight = cellHeight * 0.75 - imagePadding * 2;
        
        // Calculate image dimensions to fit while maintaining aspect ratio (object-fit: contain)
        const aspectRatio = img.naturalWidth / img.naturalHeight;
        let drawWidth = imageAreaWidth;
        let drawHeight = drawWidth / aspectRatio;
        if (drawHeight > imageAreaHeight) {
            drawHeight = imageAreaHeight;
            drawWidth = drawHeight * aspectRatio;
        }

        const imgX = x + (cellWidth - drawWidth) / 2;
        const imgY = y + imagePadding + (imageAreaHeight - drawHeight) / 2;
        
        ctx.drawImage(img, imgX, imgY, drawWidth, drawHeight);
        
        // Draw the caption
        ctx.fillStyle = '#1f2937';
        ctx.font = `55px 'Inter', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const captionY = y + cellHeight - (cellHeight - (y + imagePadding + imageAreaHeight + y)) / 2 - 20;

        ctx.fillText(style, x + cellWidth / 2, captionY);
        
        ctx.restore();
    });

    return canvas.toDataURL('image/jpeg', 0.95);
}