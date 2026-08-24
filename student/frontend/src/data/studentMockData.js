/**
 * The "Parambh Journey" stage ribbon (Orientation -> Mindset -> Skills ->
 * Projects -> Future Ready) is cosmetic labeling/copy with no backing
 * collection on the backend - kept as static illustrative data (used by
 * src/context/StudentContext.jsx). A future iteration could derive
 * status ('completed' | 'current' | 'locked') from real course module
 * completion instead of the fixed values below.
 */
export const parambhJourneyStages = [
  { id: 'stage-1', number: 1, name: 'Orientation', status: 'completed', description: 'Foundations & Vision' },
  { id: 'stage-2', number: 2, name: 'Mindset', status: 'completed', description: 'Self Growth & Resilience' },
  { id: 'stage-3', number: 3, name: 'Skills', status: 'current', description: 'Communication & Expression' },
  { id: 'stage-4', number: 4, name: 'Projects', status: 'locked', description: 'Hands-on Implementation' },
  { id: 'stage-5', number: 5, name: 'Future Ready', status: 'locked', description: 'Capstone & Mastery' },
];
