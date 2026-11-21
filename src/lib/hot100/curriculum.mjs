// Build-time access to the Hot 100 curriculum.
// The browser loads the same modules from /hot100-assets/, so they stay in public/.
export {catalog, categories, categoryLabels} from '../../../public/hot100-assets/catalog.mjs';
export {lessons} from '../../../public/hot100-assets/lessons.mjs';
export {exampleText} from '../../../public/hot100-assets/friendly-input.mjs';
