// scripts/test_remedial_engine.ts
// Ad-hoc verification of Adaptive Remedial Engine
import { generateRemedialVocab } from '../src/lib/analytics/remedialEngine';
import { HSK1_VOCAB_PRESETS, HSK2_VOCAB_PRESETS, HSK3_VOCAB_PRESETS } from '../src/lib/vocabLoader';

console.log('Testing Remedial Engine with weakPhonemes=[zh, sh] and weakTones=[3]...');

const vocab = [...HSK1_VOCAB_PRESETS, ...HSK2_VOCAB_PRESETS, ...HSK3_VOCAB_PRESETS];

const result = generateRemedialVocab(
	{
		hasData: true,
		weakPhonemes: ['zh', 'sh'],
		weakTones: [3]
	},
	vocab,
	6
);

console.log(`Generated ${result.length} remedial cards:`);
result.forEach((card, idx) => {
	console.log(`${idx + 1}. [${card.tag}] ${card.hanzi} (${card.pinyin}) - ${card.thai} | เหตุผล: ${card.reason}`);
});

// Verification check
const allValid = result.every((card) => {
	const hasZhSh = card.tag.includes('zh') || card.tag.includes('sh') || card.reason.includes('zh') || card.reason.includes('sh');
	const hasTone3 = card.tag.includes('เสียงที่ 3') || card.reason.includes('เสียงที่ 3');
	return hasZhSh || hasTone3;
});

if (allValid && result.length === 6) {
	console.log('\n? PASS: All 6 remedial cards correctly targeted zh/sh or Tone 3!');
} else {
	console.error('\n? FAIL: Output did not match expected criteria.');
	process.exit(1);
}
