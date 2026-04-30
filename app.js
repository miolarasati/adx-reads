// Firebase setup
firebase.initializeApp({
  apiKey: "AIzaSyB4EapE6qXRpzG9PPmhwM79ssTmNOeXBHI",
  authDomain: "adx-reads.firebaseapp.com",
  databaseURL: "https://adx-reads-default-rtdb.firebaseio.com",
  projectId: "adx-reads",
  storageBucket: "adx-reads.firebasestorage.app",
  messagingSenderId: "158199368561",
  appId: "1:158199368561:web:7f541d36c6a1e63e3984d0",
});

const db = firebase.database();
const booksRef = db.ref('books');

const BOOK_COLORS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c',
  '#3498db', '#9b59b6', '#e84393', '#00b894', '#6c5ce7',
  '#fd79a8', '#0984e3', '#d63031', '#a29bfe', '#00cec9',
  '#fab1a0', '#74b9ff', '#55efc4', '#b2bec3', '#636e72',
];

const MIN_HEIGHT = 150;
const MAX_HEIGHT = 210;

const shelf = document.getElementById('shelf');
const modal = document.getElementById('modal');
const addBtn = document.getElementById('addBookBtn');
const cancelBtn = document.getElementById('cancelBtn');
const form = document.getElementById('bookForm');
const descInput = document.getElementById('bookDesc');
const charCount = document.getElementById('charCount');

function randomColor() {
  return BOOK_COLORS[Math.floor(Math.random() * BOOK_COLORS.length)];
}

function randomHeight() {
  return MIN_HEIGHT + Math.floor(Math.random() * (MAX_HEIGHT - MIN_HEIGHT));
}

function buildGoodreadsSearchUrl(title) {
  return `https://www.goodreads.com/search?q=${encodeURIComponent(title)}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function createBookEl(book, bookKey) {
  const el = document.createElement('div');
  el.className = 'book';
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', `${book.title} — added by ${book.reader}`);

  const link = book.link || buildGoodreadsSearchUrl(book.title);
  const borrowedBy = book.borrowedBy ? `Borrowed by ${escapeHtml(book.borrowedBy)}` : '';

  el.innerHTML = `
    <div class="book-tooltip">
      <div class="tt-title">${escapeHtml(book.title)}</div>
      <div class="tt-desc">${escapeHtml(book.desc)}</div>
      <div class="tt-reader">Added by ${escapeHtml(book.reader)}</div>
      ${borrowedBy ? `<div class="tt-borrowed">${borrowedBy}</div>` : ''}
      <div class="tt-actions">
        <a href="${escapeHtml(link)}" target="_blank" rel="noopener" class="tt-link">View on Goodreads</a>
        <button class="tt-borrow-btn" data-key="${bookKey}">${book.borrowedBy ? 'Return Book' : 'Borrow Book'}</button>
      </div>
      <div class="tt-actions tt-manage">
        <button class="tt-edit-btn" data-key="${bookKey}">✏️ Edit</button>
        <button class="tt-delete-btn" data-key="${bookKey}">🗑 Delete</button>
      </div>
    </div>
    <div class="book-spine" style="height:${book.height}px;background:${book.color}">
      ${escapeHtml(book.title)}
    </div>
  `;

  // Handle borrow/return
  el.querySelector('.tt-borrow-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (book.borrowedBy) {
      booksRef.child(bookKey).update({ borrowedBy: null });
    } else {
      const alias = prompt('Enter your alias to borrow this book:');
      if (alias && alias.trim()) {
        const borrower = alias.trim();
        booksRef.child(bookKey).update({ borrowedBy: borrower });
        // Use location.href instead of window.open to avoid popup blockers
        const slackUrl = `https://amazon.enterprise.slack.com/messages/${encodeURIComponent(book.reader)}`;
        const openSlack = confirm(`Opening Slack DM with ${book.reader}. Continue?`);
        if (openSlack) {
          window.location.href = slackUrl;
        }
      }
    }
  });

  // Goodreads link on click (but not on tooltip)
  el.querySelector('.tt-link').addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Edit book
  el.querySelector('.tt-edit-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    editingKey = bookKey;
    document.getElementById('modalTitle').textContent = 'Edit Book';
    document.getElementById('bookTitle').value = book.title;
    document.getElementById('bookDesc').value = book.desc;
    document.getElementById('bookReader').value = book.reader;
    document.getElementById('bookLink').value = book.link || '';
    charCount.textContent = book.desc.length;
    document.querySelector('.btn-submit').textContent = 'Save Changes';
    modal.classList.add('active');
    document.getElementById('bookTitle').focus();
  });

  // Delete book
  el.querySelector('.tt-delete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm(`Remove "${book.title}" from the shelf?`)) {
      booksRef.child(bookKey).remove();
    }
  });

  return el;
}

function renderBooks(booksObj) {
  shelf.querySelectorAll('.book').forEach(b => b.remove());
  if (!booksObj) return;

  Object.entries(booksObj).forEach(([key, book]) => {
    shelf.insertBefore(createBookEl(book, key), addBtn);
  });
}

let editingKey = null;

function openModal() {
  editingKey = null;
  document.getElementById('modalTitle').textContent = 'Add a Book';
  document.querySelector('.btn-submit').textContent = 'Place on Shelf';
  modal.classList.add('active');
  document.getElementById('bookTitle').focus();
}

function closeModal() {
  modal.classList.remove('active');
  form.reset();
  charCount.textContent = '0';
  editingKey = null;
}

// Real-time listener — syncs across all browsers
booksRef.on('value', (snapshot) => {
  renderBooks(snapshot.val());
});

// Events
addBtn.addEventListener('click', openModal);
cancelBtn.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
descInput.addEventListener('input', () => { charCount.textContent = descInput.value.length; });

form.addEventListener('submit', (e) => {
  e.preventDefault();

  const bookData = {
    title: document.getElementById('bookTitle').value.trim(),
    desc: document.getElementById('bookDesc').value.trim(),
    reader: document.getElementById('bookReader').value.trim(),
    link: document.getElementById('bookLink').value.trim() || '',
  };

  if (editingKey) {
    booksRef.child(editingKey).update(bookData);
  } else {
    bookData.color = randomColor();
    bookData.height = randomHeight();
    booksRef.push(bookData);
  }

  closeModal();
});
