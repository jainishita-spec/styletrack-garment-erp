export const PARTY_TYPES = ['Buyer', 'Fabric Mill', 'Dyeing', 'Printing', 'Embroidery', 'Stitching', 'Washing', 'Trims', 'Packing', 'Transport', 'Other'];
export const MATERIAL_CATEGORIES = ['Fabric', 'Trim', 'Packing', 'Other'];
export const UNITS = ['Mtr', 'Kg', 'Pcs', 'Set', 'Roll', 'Dozen', 'Gross'];
export const PROCESS_TYPES = ['Purchase', 'Job Work', 'In-house'];
export const PROCESS_STATUSES = ['Pending', 'In Progress', 'Done', 'Skipped'];
export const STYLE_STATUSES = ['Open', 'In Production', 'Completed', 'Cancelled'];
export const EXPENSE_CATEGORIES = ['Stitching', 'Cutting', 'Karigar', 'Finishing', 'Packing', 'Transport', 'Sampling', 'Other'];
export const ROLES = ['admin', 'merchant', 'store', 'production', 'accounts'];

// Default 12-step process route for a garment style (editable per style)
export const DEFAULT_PROCESSES = [
  { process_name: 'Fabric Purchase', process_type: 'Purchase' },
  { process_name: 'Dyeing', process_type: 'Job Work' },
  { process_name: 'Printing', process_type: 'Job Work' },
  { process_name: 'Embroidery', process_type: 'Job Work' },
  { process_name: 'Cutting', process_type: 'In-house' },
  { process_name: 'Stitching', process_type: 'In-house' },
  { process_name: 'Button / Trims', process_type: 'In-house' },
  { process_name: 'Washing', process_type: 'Job Work' },
  { process_name: 'Finishing & Press', process_type: 'In-house' },
  { process_name: 'Checking', process_type: 'In-house' },
  { process_name: 'Packing', process_type: 'In-house' },
  { process_name: 'Dispatch', process_type: 'In-house' },
];

// Who can do what (backend enforces the same rules)
const PERMS = {
  style: ['merchant'],
  po: ['merchant'],
  party: ['merchant', 'store'],
  movement: ['store'],
  expense: ['accounts', 'production', 'merchant'],
  sale: ['accounts', 'store', 'merchant'],
  process: ['merchant', 'production', 'store'],
};
export const can = (user, action) => !!user && (user.role === 'admin' || (PERMS[action] || []).includes(user.role));

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
export const money = (n) => `₹${inr.format(Number(n || 0))}`;
export const qty = (n) => inr.format(Number(n || 0));
export const fdate = (d) => {
  if (!d) return '—';
  const [y, m, day] = String(d).slice(0, 10).split('-');
  return `${day}-${m}-${y}`;
};
export const today = () => new Date().toISOString().slice(0, 10);
