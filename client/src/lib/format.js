const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const date = (d) => (d ? dateFmt.format(new Date(d)) : '');
export const shortDate = (d) => (d ? shortFmt.format(new Date(d)) : '');
export const dateTime = (d) => (d ? timeFmt.format(new Date(d)) : '');

export const stars = (x) => (x == null ? '–' : Number(x).toFixed(1));
export const percent = (x) => (x == null ? '–' : `${Math.round(x * 100)}%`);

export function gapWords(gap) {
  if (gap == null) return '';
  const g = Math.abs(gap).toFixed(1);
  if (Math.abs(gap) < 0.15) return 'about the same as clients';
  return gap < 0 ? `${g} stars below clients` : `${g} stars above clients`;
}

export function daysFromNow(d) {
  const days = Math.ceil((new Date(d) - Date.now()) / 86400000);
  if (days <= 0) return 'expired';
  return days === 1 ? '1 day left' : `${days} days left`;
}

export const STATUS_LABEL = {
  assigned: 'To do',
  in_progress: 'In progress',
  submitted: 'Waiting for review',
  delivered: 'With the client',
};

export const STAR_WORDS = { 1: 'Poor', 2: 'Below expectations', 3: 'Okay', 4: 'Good', 5: 'Excellent' };

export const OUTCOME_LABEL = {
  no_issue: 'No issue found',
  discussed_with_manager: 'Discussed with the manager',
  escalated: 'Escalated',
};

export const ROLE_LABEL = { hr: 'HR', manager: 'Manager', employee: 'Employee' };
