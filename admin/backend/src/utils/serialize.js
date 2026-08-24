/**
 * `.lean()` query results are plain objects with only `_id` (Mongoose
 * virtuals, including the automatic `id` string getter, don't run on lean
 * results). This adds `id` back so lean list endpoints return the same
 * `{ _id, id, ... }` shape as single-document (non-lean) responses.
 */
export function withId(doc) {
  if (!doc) return doc;
  return { ...doc, id: String(doc._id) };
}

export function withIds(docs) {
  return docs.map(withId);
}

export default { withId, withIds };
