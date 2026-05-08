import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const documentedFunctionRoots = [
  'src/llm/tools',
  'src/shared/types/tools',
  'src/ui/tools',
];

/**
 * Collects TypeScript source files under a repository-relative path.
 *
 * @param root - Repository-relative file or directory path.
 * @returns Source file paths under the root.
 */
function collectSourceFiles(root: string): string[] {
  const stat = statSync(root);
  if (!stat.isDirectory()) {
    return root.endsWith('.ts') || root.endsWith('.tsx') ? [root] : [];
  }

  return readdirSync(root)
    .flatMap((entry) => collectSourceFiles(join(root, entry)))
    .filter((filePath) => !filePath.endsWith('.d.ts'));
}

/**
 * Checks whether a node has a JSDoc block attached.
 *
 * @param node - The TypeScript AST node to inspect.
 * @returns True when TypeScript can associate a JSDoc block with the node.
 */
function hasJsDoc(node: ts.Node): boolean {
  return ts.getJSDocCommentsAndTags(node).length > 0;
}

/**
 * Checks whether a declaration has an export modifier.
 *
 * @param node - The declaration node to inspect.
 * @returns True when the declaration is exported from its module.
 */
function isExported(node: ts.Node): boolean {
  return Boolean(ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

/**
 * Finds exported functions and exported class methods that are missing JSDoc.
 *
 * @param filePath - Repository-relative TypeScript source file path.
 * @returns Human-readable missing documentation entries.
 */
function findUndocumentedExports(filePath: string): string[] {
  const sourceText = readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const missingEntries: string[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name && isExported(node) && !hasJsDoc(node)) {
      const line = sourceFile.getLineAndCharacterOfPosition(node.name.pos).line + 1;
      missingEntries.push(`${filePath}:${line} ${node.name.text}`);
    }

    if (
      ts.isMethodDeclaration(node) &&
      node.name &&
      ts.isClassDeclaration(node.parent) &&
      isExported(node.parent) &&
      !hasJsDoc(node)
    ) {
      const line = sourceFile.getLineAndCharacterOfPosition(node.name.pos).line + 1;
      missingEntries.push(`${filePath}:${line} ${node.name.getText(sourceFile)}`);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return missingEntries;
}

describe('quality rules', () => {
  it('keeps exported tool-scope functions documented', () => {
    const missingEntries = documentedFunctionRoots
      .flatMap((root) => collectSourceFiles(root))
      .flatMap(findUndocumentedExports)
      .map((entry) => relative(process.cwd(), entry));

    expect(missingEntries).toEqual([]);
  });
});
