export enum FeedResponseRequestStatus {
  InternalError = "INTERNAL_ERROR",
  ParseError = "PARSE_ERROR",
  Pending = "PENDING",
  Success = "SUCCESS",
  BadStatusCode = "BAD_STATUS_CODE",
  FetchError = "FETCH_ERROR",
  FetchTimeout = "FETCH_TIMEOUT",
  MatchedHash = "MATCHED_HASH",
}
