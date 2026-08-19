import { error } from '@sveltejs/kit';
import { findLesson } from '$lib/data/lessons';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const result = findLesson(params.unit, params.lesson);
	if (!result) throw error(404, 'Lesson not found');
	return {
		unit: result.unit,
		lesson: result.lesson
	};
};
