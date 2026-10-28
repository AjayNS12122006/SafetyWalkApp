export function hasValidCoordinates(latitude, longitude) {
  const lat = typeof latitude === 'number'
    ? latitude
    : typeof latitude === 'string' && latitude.trim()
      ? Number(latitude)
      : NaN;
  const lng = typeof longitude === 'number'
    ? longitude
    : typeof longitude === 'string' && longitude.trim()
      ? Number(longitude)
      : NaN;

  return Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= -90
    && lat <= 90
    && lng >= -180
    && lng <= 180;
}
