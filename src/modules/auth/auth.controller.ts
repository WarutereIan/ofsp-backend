const COOKIE_OPTIONS = {
  sameSite: 'none',  // Support cross-domain cookies on mobile browsers
  secure: true,      // Always use secure cookies
  partitioned: true, // Enable Cookie Partitioning support
};

export default COOKIE_OPTIONS;