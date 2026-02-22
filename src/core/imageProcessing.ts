export function toGrayscale(imageData: ImageData): Uint8Array {
  const pixelCount = imageData.width * imageData.height;
  const gray = new Uint8Array(pixelCount);
  const data = imageData.data;
  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    gray[i] = Math.round(
      0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2],
    );
  }
  return gray;
}

export function toBinary(grayscale: Uint8Array, threshold: number = 128): Uint8Array {
  const binary = new Uint8Array(grayscale.length);
  for (let i = 0; i < grayscale.length; i++) {
    binary[i] = grayscale[i] < threshold ? 1 : 0;
  }
  return binary;
}

export function horizontalProjection(
  binary: Uint8Array,
  width: number,
  height: number,
): number[] {
  const projection = new Array<number>(height).fill(0);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      projection[y] += binary[rowOffset + x];
    }
  }
  return projection;
}
