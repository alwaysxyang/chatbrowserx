import type { CandidateItem } from './interactable-candidate';
import { rectOverlapRatio } from './geometry';
import {
  isUnlabeledFallbackName,
  readSemanticLabelFromElement,
} from './interactable-naming';

/**
 * Checks whether a nested semantic icon is only the visual glyph of a named parent control.
 *
 * @param parent - The ancestor candidate.
 * @param child - The descendant candidate.
 * @returns True when the child should be removed as duplicate icon noise.
 */
function isNestedDecorativeIconCandidate(parent: CandidateItem, child: CandidateItem): boolean {
  if (!['button', 'link'].includes(parent.role)) return false;
  if (child.role !== 'button' || !parent.name || isUnlabeledFallbackName(parent.name)) return false;
  if (!readSemanticLabelFromElement(child.element, { includeDescendants: true })) return false;

  const parentArea = parent.rect[2] * parent.rect[3];
  const childArea = child.rect[2] * child.rect[3];
  const isCompactChild = child.rect[2] <= 48 && child.rect[3] <= 48;

  return parentArea > 0 && childArea > 0 && isCompactChild && childArea <= parentArea * 0.7;
}

/**
 * Checks whether an accessibility textbox duplicates a richer code editor surface.
 *
 * @param codeEditor - Candidate representing the code editor surface.
 * @param duplicate - Candidate that may duplicate the editor.
 * @returns True when the duplicate should be removed.
 */
function isOverlappingCodeEditorTextboxDuplicate(codeEditor: CandidateItem, duplicate: CandidateItem): boolean {
  if (codeEditor.inputType !== 'code') return false;
  if (duplicate.inputType === 'code' || duplicate.role !== 'textbox') return false;

  const duplicateName = duplicate.name.toLowerCase();
  const looksLikeEditorAccessibilityNode = duplicateName.includes('editor content') ||
    duplicateName.includes('accessibility options');

  return looksLikeEditorAccessibilityNode && rectOverlapRatio(codeEditor.rect, duplicate.rect) >= 0.9;
}

/**
 * Checks whether a parent candidate already represents the child candidate.
 *
 * @param parent - The ancestor candidate.
 * @param child - The descendant candidate.
 * @returns True when the child would be duplicate noise in the snapshot.
 */
function isNestedDuplicateCandidate(parent: CandidateItem, child: CandidateItem): boolean {
  if (!parent.element.contains(child.element)) return false;
  if (isUnlabeledFallbackName(child.name)) return true;
  if (isNestedDecorativeIconCandidate(parent, child)) return true;
  if (parent.element.contains(child.element) && parent.role === 'button' && (child.role === 'checkbox' || child.role === 'radio')) {
    return true;
  }
  if (parent.role !== child.role) return false;
  if (!child.name) return true;
  return parent.name === child.name || parent.name.includes(child.name);
}

/**
 * Removes descendants already represented by an earlier candidate.
 *
 * @param items - Candidate items in DOM order.
 * @returns Candidate items without nested duplicates.
 */
function removeNestedDuplicateCandidates(items: CandidateItem[]): CandidateItem[] {
  const deduplicatedItems: CandidateItem[] = [];

  for (const item of items) {
    if (!deduplicatedItems.some((candidate) => isNestedDuplicateCandidate(candidate, item))) {
      deduplicatedItems.push(item);
    }
  }

  return deduplicatedItems;
}

/**
 * Removes accessibility textboxes that duplicate an overlapping code editor surface.
 *
 * @param items - Candidate items after nested duplicate removal.
 * @returns Candidate items without code editor accessibility duplicates.
 */
function removeOverlappingCodeEditorTextboxDuplicates(items: CandidateItem[]): CandidateItem[] {
  const codeEditorItems = items.filter((item) => item.inputType === 'code');

  if (codeEditorItems.length === 0) {
    return items;
  }

  return items.filter((item) => !codeEditorItems.some((codeEditor) => (
    codeEditor !== item &&
    isOverlappingCodeEditorTextboxDuplicate(codeEditor, item)
  )));
}

/**
 * Removes duplicate candidates that describe the same interactive surface.
 *
 * @param items - Candidate items in DOM order.
 * @returns Deduplicated candidate items.
 */
export function deduplicateNestedCandidates(items: CandidateItem[]): CandidateItem[] {
  return removeOverlappingCodeEditorTextboxDuplicates(removeNestedDuplicateCandidates(items));
}
