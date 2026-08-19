import { error } from '@sveltejs/kit';
import { findScenario } from '$lib/data/scenarios';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const scenario = findScenario(params.id);
	if (!scenario) throw error(404, 'Scenario not found');
	return { scenario };
};
