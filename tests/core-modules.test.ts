import test from 'node:test';
import assert from 'node:assert/strict';

import {
	MAX_LEARNER_LEVEL,
	getBossAssessmentConfig,
	getLearnerStage
} from '../src/lib/gamification.ts';
import { extractInitial, generateRemedialVocab } from '../src/lib/analytics/remedialEngine.ts';
import {
	computeDeterministicAcousticMetrics,
	computePairedTTest
} from '../src/lib/analytics/statisticalEngine.ts';
import { matchChineseWord, verifySentenceReading } from '../src/lib/speech.ts';

test('gamification stages clamp levels safely from 1 to MAX_LEARNER_LEVEL', () => {
	assert.equal(getLearnerStage(0).name, 'ลูกช้าง');
	assert.equal(getLearnerStage(1).hskLevel, 1);
	assert.equal(getLearnerStage(MAX_LEARNER_LEVEL).name, 'ช้างตำนาน');
	assert.equal(getLearnerStage(99).hskLevel, 3);

	const boss1 = getBossAssessmentConfig(1);
	assert.equal(boss1.questionCount, 10);
	assert.equal(boss1.passPercent, 70);

	const boss9 = getBossAssessmentConfig(9);
	assert.equal(boss9.questionCount, 30);
	assert.equal(boss9.passPercent, 90);
});

test('statisticalEngine computes deterministic GOP/tone/Chao metrics without randomness', () => {
	const points = [
		{ timeMs: 0, f0: 210, volume: 0.08, clarity: 0.92, chaoLevel: 5 },
		{ timeMs: 120, f0: 165, volume: 0.09, clarity: 0.9, chaoLevel: 3 },
		{ timeMs: 240, f0: 115, volume: 0.07, clarity: 0.88, chaoLevel: 1 }
	];

	const first = computeDeterministicAcousticMetrics({
		points,
		targetTone: 4,
		detectedTone: 4,
		aiConfidence: 0.9,
		isWordMatch: true
	});
	const second = computeDeterministicAcousticMetrics({
		points,
		targetTone: 4,
		detectedTone: 4,
		aiConfidence: 0.9,
		isWordMatch: true
	});

	assert.deepEqual(first, second);
	assert.equal(first.slopeType, 'falling');
	assert.equal(first.chaoContour, '51');
	assert.equal(first.per, 0);
	assert.ok(first.gop >= 85 && first.gop <= 100);
	assert.ok(first.toneScore >= 85 && first.toneScore <= 100);
});

test('computePairedTTest measures positive learning gain accurately', () => {
	const res = computePairedTTest([50, 55, 60, 45, 52], [80, 85, 88, 78, 82]);

	assert.equal(res.n, 5);
	assert.ok(res.meanPost > res.meanPre);
	assert.equal(res.isSignificant05, true);
	assert.ok(res.pValue !== null && res.pValue < 0.05);
});

test('remedialEngine parses pinyin initials and prioritizes weak targets', () => {
	assert.equal(extractInitial('zhōng'), 'zh');
	assert.equal(extractInitial('zǎo'), 'z');
	assert.equal(extractInitial('shū'), 'sh');
	assert.equal(extractInitial('ài'), '');

	const cards = generateRemedialVocab(
		{
			hasData: true,
			weakPhonemes: ['zh'],
			weakTones: [3]
		},
		[
			{ id: '1', hanzi: '妈', pinyin: 'mā', english: 'mom', thai: 'แม่', tone: 1, category: '1st' },
			{ id: '2', hanzi: '找', pinyin: 'zhǎo', english: 'find', thai: 'หา', tone: 3, category: '3rd' },
			{ id: '3', hanzi: '是', pinyin: 'shì', english: 'be', thai: 'ใช่', tone: 4, category: '4th' }
		],
		4
	);

	assert.equal(cards.length, 1);
	assert.equal(cards[0].hanzi, '找');
});

test('speech matchers verify single words, homophones, and sentence coverage', () => {
	const exact = matchChineseWord('你好', ['你好'], 'nǐ hǎo');
	assert.equal(exact.isMatch, true);
	assert.equal(exact.similarity, 100);

	const sentence = verifySentenceReading('我爱你', ['我你']);
	assert.equal(sentence.isAllCorrect, false);
	assert.deepEqual(sentence.missingChars, ['爱']);
	assert.equal(sentence.correctCharsCount, 2);
});
