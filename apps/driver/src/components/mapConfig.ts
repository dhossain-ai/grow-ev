import { colors } from '../features/map/tokens';
import premiumMapStyle from './premiumMapStyle.json';
// Positron's existing layers, tile sources and zoom rules with restrained premium colors.
export const PREMIUM_MAP_STYLE = JSON.stringify(premiumMapStyle);
export const VILNIUS_CENTER: [number, number] = [25.2797, 54.6872];
export const VILNIUS_INITIAL_ZOOM = 12;
export const MAP_ERROR_BACKGROUND_COLOR = colors.surface;
export const MAP_ERROR_TEXT_COLOR = colors.textPrimary;
