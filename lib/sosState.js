// Remembers the most recent SOS so the SOS screen can offer one-tap
// WhatsApp buttons (free, no gateway) for each trusted contact.
let last = null;
export const setLastSOS = (v) => { last = v; };
export const getLastSOS = () => last;
