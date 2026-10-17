// The Dev mark: a specification, a clause sealed inside it, and three readers.
//
// The rectangle is the document; the short bar across it is the frozen
// requirement, stamped; the three dots along the base are the panel reading the
// same clause separately. Nothing here is anyone's logo but Dev's.

export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 26 26"
      fill="none"
      aria-hidden="true"
      role="presentation"
    >
      <rect
        x="4.5"
        y="2.5"
        width="17"
        height="16"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path
        d="M8 7.5h7M8 11h10M8 14.5h5"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M15.5 14.5l1.6 1.6 3-3.2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6" cy="22" r="1.6" fill="currentColor" fillOpacity="0.85" />
      <circle cx="13" cy="22" r="1.6" fill="currentColor" fillOpacity="0.55" />
      <circle cx="20" cy="22" r="1.6" fill="currentColor" fillOpacity="0.85" />
    </svg>
  );
}
