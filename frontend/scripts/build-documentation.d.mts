import type {DocLanguage, DocSection} from '../src/documentation/content';

export function escapeHtml(value: unknown): string;
export function serializeForHtml(value: unknown): string;
export function renderOfflineDocumentation(data?: Record<DocLanguage, DocSection[]>): string;
