/**
 * Region Debug Utilities
 * 
 * Helper functions for visualizing and debugging region-based generation
 */

import logger from './logger.js';

/**
 * Log region statistics to console
 */
export function logRegionStats(regions, hexToRegion) {
  if (!regions || regions.length === 0) {
    logger.mapgen.warn('No regions to display stats for');
    return;
  }

  logger.mapgen.group('Region Statistics', () => {
    logger.mapgen.info('Total regions:', regions.length);
    
    // Count hexes per region
    const hexCounts = new Map();
    hexToRegion.forEach((regionId) => {
      hexCounts.set(regionId, (hexCounts.get(regionId) || 0) + 1);
    });

    // Biome distribution
    const biomeDistribution = {};
    regions.forEach((region, idx) => {
      const biomeKey = region.biome.key;
      biomeDistribution[biomeKey] = (biomeDistribution[biomeKey] || 0) + 1;
      
      logger.mapgen.debug(`Region ${idx} (${biomeKey})`, {
        center: `${region.centerHex.col},${region.centerHex.row}`,
        radius: region.radius.toFixed(1),
        hexes: hexCounts.get(idx) || 0,
        elevation: region.elevation.toFixed(1),
        moisture: region.moisture.toFixed(1),
        temp: `${region.temperature.toFixed(1)}°C`,
        weather: region.weatherPattern?.key || 'none'
      });
    });

    logger.mapgen.table(biomeDistribution);
  });
}

/**
 * Get region boundary hexes for drawing
 */
export function getRegionBoundaries(regions) {
  const boundaries = [];
  
  regions.forEach(region => {
    region.boundaries.forEach(hexKey => {
      const [col, row] = hexKey.split(',').map(Number);
      boundaries.push({ col, row, regionId: region.id, biome: region.biome.key });
    });
  });
  
  return boundaries;
}

/**
 * Get region color for visualization (lighter versions of biome colors)
 */
export function getRegionColor(biomeKey) {
  const colors = {
    'temperate_forest': '#90EE90AA',
    'tropical_jungle': '#228B2280',
    'arid_desert': '#EDC9AF80',
    'arctic_tundra': '#E0E0E080',
    'alpine_highlands': '#8B735580',
    'wetlands': '#4F794280',
    'coastal': '#4682B480'
  };
  
  return colors[biomeKey] || '#CCCCCC40';
}

/**
 * Draw region boundaries on canvas (debug mode)
 */
export function drawRegionBoundaries(ctx, regions, hexSize, offsetX, offsetY) {
  regions.forEach(region => {
    ctx.strokeStyle = '#FF000080';
    ctx.lineWidth = 2;
    
    region.boundaries.forEach(hexKey => {
      const [col, row] = hexKey.split(',').map(Number);
      const x = col * hexSize * Math.sqrt(3) + (row % 2) * hexSize * Math.sqrt(3) / 2 + offsetX;
      const y = row * hexSize * 1.5 + offsetY;
      
      // Draw small circle at boundary hex
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.stroke();
    });
  });
}

/**
 * Get weather info for display
 */
export function getWeatherDisplay(weatherSystem, regions) {
  if (!weatherSystem || !regions) return 'No weather data';
  
  const weatherSummary = {};
  regions.forEach(region => {
    const weather = region.weatherPattern?.key || 'unknown';
    weatherSummary[weather] = (weatherSummary[weather] || 0) + 1;
  });
  
  return weatherSummary;
}
