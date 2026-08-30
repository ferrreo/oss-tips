/** Runtime-only StyleX helpers for Svelte templates.
 *
 * Static recipes import `@stylexjs/stylex` directly so the compiler extracts
 * them. Svelte templates import this bridge so the compiler never parses raw
 * `.svelte` markup as JSX.
 */
import * as stylex from '@stylexjs/stylex';

export { stylex };
