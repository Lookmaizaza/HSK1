import { existsSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT_DIR = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_LIB_DIR = resolvePath(ROOT_DIR, 'src/lib');

function resolveWithExtension(candidatePath) {
	const attempts = [
		candidatePath,
		`${candidatePath}.ts`,
		`${candidatePath}.js`,
		resolvePath(candidatePath, 'index.ts'),
		resolvePath(candidatePath, 'index.js')
	];
	for (const filePath of attempts) {
		if (existsSync(filePath)) {
			return pathToFileURL(filePath).href;
		}
	}
	return null;
}

export async function resolve(specifier, context, nextResolve) {
	if (specifier.startsWith('$lib/')) {
		const target = resolveWithExtension(resolvePath(SRC_LIB_DIR, specifier.slice('$lib/'.length)));
		if (target) {
			return { url: target, shortCircuit: true };
		}
	}

	if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
		const parentDir = dirname(fileURLToPath(context.parentURL));
		const target = resolveWithExtension(resolvePath(parentDir, specifier));
		if (target) {
			return { url: target, shortCircuit: true };
		}
	}

	return nextResolve(specifier, context);
}

