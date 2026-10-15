/** BoxHauls Driver: API calls and shared types. */
export async function post<T>(url: string, body: unknown = {}): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({ message: 'Something went wrong. Check your connection.' }));
  if (!res.ok) throw Object.assign(new Error(data.message ?? 'Something went wrong.'), data);
  return data as T;
}

export const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

export interface Step {
  key: string;
  label: string;
  state: 'todo' | 'done' | 'review';
}

export interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  preferredName: string;
  email: string;
  phone: string;
  status: 'applying' | 'submitted' | 'approved' | 'rejected' | 'suspended' | 'deactivated';
  rejectionReason: string | null;
  canDrive: boolean;
  online: boolean;
  navApp: 'google' | 'apple' | 'waze';
  smsOptIn: boolean;
  memberSince: string;
  personal: { dateOfBirth: string; address1: string; address2: string; city: string; state: string; postalCode: string };
  emergency: { name: string; phone: string };
  license: { number: string; state: string; expiry: string };
  vehicle: { year: number | ''; make: string; model: string; color: string; plate: string; plateState: string; vin: string; bedLength: string };
  registration: { expiry: string };
  insurance: { carrier: string; policyNumber: string; expiry: string };
  background: { consentedAt: string | null; status: string };
  payoutsReady: boolean;
  agreementAcceptedAt: string | null;
  steps: Step[];
  readyToSubmit: boolean;
}

export interface Offer {
  id: string;
  item: string;
  jobType: string;
  pickupCity: string;
  dropoffCity: string;
  miles: number;
  when: string;
  asap: boolean;
  payoutCents: number;
  heavy: boolean;
  dump: string | null;
  expiresAt: string | null;
}

export interface Trip extends Offer {
  stage: 'to_pickup' | 'at_pickup' | 'to_dropoff';
  pickup: string;
  dropoff: string;
  customer: { firstName: string; phone: string };
  notes: string | null;
  dumpRun: boolean;
  dumpCapCents: number;
  tipCents: number;
}

export interface LiveState {
  online: boolean;
  canDrive: boolean;
  status: string;
  offers: Offer[];
  trips: Trip[];
  today: { cents: number; trips: number; onlineMinutes: number };
}

/** Navigation link for the driver's chosen app. */
export function navUrl(app: Driver['navApp'], address: string): string {
  const q = encodeURIComponent(address);
  if (app === 'apple') return `https://maps.apple.com/?daddr=${q}&dirflg=d`;
  if (app === 'waze') return `https://waze.com/ul?q=${q}&navigate=yes`;
  return `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`;
}

/** Resize a photo in the browser (longest side ≤ 1600 px, JPEG) before upload. */
export async function resizeImage(file: File, max = 1600): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('That file isn’t a photo we can read. Try a JPEG or PNG.'));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}
