declare namespace App {
  interface Locals {
    /** The signed-in account, if any. */
    user?: import('./server/users.ts').User;
    /** Who the page is rendered for. Always set by the middleware. */
    viewer: import('./server/posts.ts').Viewer;
    /** True for the endministrator, also while they browse as a guest. */
    endmin?: boolean;
  }
}
