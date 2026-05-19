# Security Specification - Eelarvemeister

## Data Invariants
- A transaction cannot exist without a valid user ID.
- A user can only access transactions, categories, budgets, and rules where `userId == request.auth.uid`.
- Categories must have a type of 'income', 'expense', or 'both'.
- Budget amount must be a number.

## The Dirty Dozen Payloads
1. Create user profile with a different UID.
2. Read transactions of another user.
3. Update a transaction and change the `userId`.
4. Delete a category that belongs to another user.
5. Create a budget for a category that doesn't exist.
6. Create a rule with an extremely large pattern string (1MB).
7. Update `isStarred` on a category belonging to someone else.
8. Set a transaction date to a future time from the client (if we want to restrict this).
9. Create a transaction with a negative amount (if we allow both income/expense via sign, we should be careful).
10. Spoofing user identity by providing a fake token (handled by Firebase).
11. Reading PII of other users (username, etc.).
12. Bulk deleting transactions via insecure list rules.

## Test Runner
(I'll output the rules first as per Phase 2-4)
