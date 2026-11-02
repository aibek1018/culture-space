# CULTURE SPACE — GraphQL API Design

**Status:** APPROVED  
**Version:** 0.4  
**Approved:** 2026-11-02 by the product owner, as proposed  
**Style:** NestJS GraphQL Code First. One schema. No federation.

Business operations are GraphQL operations. `GET /health` and `GET /ready` are the only HTTP routes, and they are infrastructure probes. This contract is approved. Generating the schema and installing packages wait for the separate instruction to start Milestone 1.

---

## 1. Conventions

| Topic | Convention |
| --- | --- |
| Endpoint | `POST /graphql` on the same origin as the web application |
| Subscriptions | `graphql-ws` on the same path |
| Naming | Queries and mutations are camelCase verbs. Types are PascalCase. Inputs end with `Input` |
| Enums | GraphQL enums. Stored as checked `varchar` values with the same names |
| Nullability | Absent data is null. Empty lists are `[]`. Private hidden records are `NOT_FOUND`, not null fields inside a leaked object |
| Entities | TypeORM entities are not GraphQL types. Resolvers return mapper outputs or dedicated object types |
| Validation | Input types use class-validator. Limits are listed with each input |
| Errors | `extensions.code` and `extensions.i18nKey`. See `ARCHITECTURE.md` |
| Identity | The current user comes from the Redis session. Mutations ignore any client-supplied owner id |
| Pagination cap | Default page size 20. Maximum 50 |

### 1.1. Pagination

Catalog browsing uses offset pagination:

```graphql
type OffsetPageInfo {
  page: Int!
  pageSize: Int!
  totalCount: Int!
  hasNextPage: Boolean!
}

type WorkOffsetConnection {
  nodes: [Work!]!
  pageInfo: OffsetPageInfo!
}
```

Feeds, discussions, comments, notifications, reviews, and member lists use cursor pagination:

```graphql
type PageInfo {
  endCursor: String
  hasNextPage: Boolean!
}

type DiscussionConnection {
  nodes: [Discussion!]!
  pageInfo: PageInfo!
}
```

The cursor is an opaque base64 document of the sort keys, usually `(createdAt, id)`. Clients treat it as opaque.

### 1.2. Authorization guards

| Guard | Effect |
| --- | --- |
| Public | Anonymous allowed |
| `Authenticated` | Valid session and `account_status = ACTIVE` |
| `Verified` | Authenticated and `email_verified_at` is set |
| `Role(MODERATOR)` | Moderator or administrator |
| `Role(ADMIN)` | Administrator |

`Verified` is required for every mutation except registration, login, logout, verification, password flows, and profile editing. Read access still applies privacy rules.

Field authorization:

- `Account` is returned only for the current user: `me`, `register`, `login`, `verifyEmail`, `updateProfile`, `updatePrivacy`, and `confirmAvatarUpload`.
- `UserProfile` has no email, password, preferences, or account status.
- `LibraryItem.notes` is resolved only for the owner.
- Club posts, club activities, and private club member lists are loaded through `ClubAccessService`.

### 1.3. Complexity

- Maximum query depth: 10.
- Maximum complexity score: 200.
- Connection fields cost `pageSize`.
- Introspection is disabled in production.

### 1.4. DataLoaders

One loader set is created per request.

| Loader | Prevents |
| --- | --- |
| `usersById` | Author lookups on reviews, comments, discussions |
| `worksById` | Work cards inside library, reviews, activities |
| `bookDetailsByWorkId`, `movieDetailsByWorkId`, `tvSeriesDetailsByWorkId` | Detail panels |
| `localizationsByWorkId` | Title lists |
| `genresByWorkId` | Genre chips |
| `personsByWorkId` | Credits |
| `videosByWorkId` | Trailers |
| `viewerRatingByWorkId` | “Your rating” |
| `viewerLibraryItemByWorkId` | “In your library” |
| `viewerReactionByTarget` | Highlighted reaction on a review, discussion, comment, or club post |
| Reaction and comment counts | Stored columns. No per-row count query |
| `clubMembershipByClubId` | Viewer role inside a club |

Resolvers do not call a repository inside a list mapper.

---

## 2. Shared types

```graphql
enum InterfaceLanguage { EN RU }
enum ProfileVisibility { PUBLIC PRIVATE }
enum LibraryVisibility { PUBLIC PRIVATE }
enum AccountRole { USER MODERATOR ADMIN }
enum WorkType { BOOK MOVIE TV_SERIES }
enum ContentStatus { PUBLISHED HIDDEN REMOVED }
enum ContentVisibility { PUBLIC PRIVATE }
enum ReactionType { LIKE INSIGHTFUL INTERESTING DISAGREE }
enum DiscussionType { WORK GENERAL }
enum LibraryStatus {
  WANT_TO_READ
  CURRENTLY_READING
  COMPLETED
  ON_HOLD
  DROPPED
  WANT_TO_WATCH
  WATCHING
  WATCHED
}
enum ClubType { BOOK_CLUB MOVIE_CLUB MIXED_CLUB }
enum ClubVisibility { PUBLIC PRIVATE }
enum MembershipPolicy { OPEN APPROVAL INVITE_ONLY }
enum ClubRole { OWNER ADMIN MODERATOR MEMBER }
enum MembershipStatus { PENDING ACTIVE REJECTED LEFT REMOVED }
enum ActivityType {
  WORK_COMPLETED
  MOVIE_WATCHED
  REVIEW_PUBLISHED
  DISCUSSION_CREATED
  CLUB_JOINED
  CLUB_POST_PUBLISHED
  CLUB_ACTIVITY_CREATED
}
enum NotificationType {
  NEW_FOLLOWER
  REVIEW_LIKE
  DISCUSSION_LIKE
  COMMENT_REPLY
  NEW_COMMENT
  CLUB_INVITATION
  CLUB_MEMBERSHIP_APPROVED
  CLUB_ACTIVITY_CREATED
  CLUB_ANNOUNCEMENT
}
enum ReportReason {
  SPAM
  HARASSMENT
  HATE_SPEECH
  SPOILERS
  INAPPROPRIATE_CONTENT
  COPYRIGHT
  OTHER
}
enum ReportTargetType { USER REVIEW DISCUSSION COMMENT CLUB_POST }
enum SortDirection { ASC DESC }

type PageInfo {
  endCursor: String
  hasNextPage: Boolean!
}

scalar DateTime
scalar Date
scalar UUID
```

`LibraryStatus` is one GraphQL enum so clients can share a control, while the database trigger still rejects illegal combinations such as `CURRENTLY_READING` on a movie.

### 2.1. Public profile and private account

```graphql
type UserProfile {
  id: UUID!
  username: String!
  fullName: String!
  avatarUrl: String
  bio: String
  countryCode: String
  createdAt: DateTime!
  profileVisibility: ProfileVisibility!
  followersCount: Int!
  followingCount: Int!
  isFollowedByViewer: Boolean!
}

type Account {
  id: UUID!
  username: String!
  fullName: String!
  email: String!
  avatarUrl: String
  bio: String
  preferredLanguage: InterfaceLanguage!
  countryCode: String
  role: AccountRole!
  profileVisibility: ProfileVisibility!
  libraryVisibility: LibraryVisibility!
  emailVerifiedAt: DateTime
  createdAt: DateTime!
  preferences: UserPreferences!
}

type UserPreferences {
  showSpoilers: Boolean!
  notifyNewFollower: Boolean!
  notifyReviewLike: Boolean!
  notifyDiscussionLike: Boolean!
  notifyCommentReply: Boolean!
  notifyNewComment: Boolean!
  notifyClubInvitation: Boolean!
  notifyClubMembership: Boolean!
  notifyClubActivity: Boolean!
  notifyClubAnnouncement: Boolean!
}
```

`Account.email` is the only email field on `Account`. `AccountSummary.email` is the administrative copy and is returned only by moderator and administrator operations (decision D-67). `Account` is returned only for the current user: `me`, `register`, `login`, `verifyEmail`, `updateProfile`, `updatePrivacy`, and `confirmAvatarUpload`.

---

## 3. Auth module

Resolver: `AuthResolver`.

| Operation | Guard | Purpose |
| --- | --- | --- |
| `register(input: RegisterInput!): Account!` | Public | Create user, preferences, verification token, session |
| `login(input: LoginInput!): Account!` | Public | Establish session |
| `logout: Boolean!` | Authenticated | Destroy current session |
| `logoutAll: Boolean!` | Authenticated | Destroy every session of the user |
| `verifyEmail(token: String!): Account!` | Public | Consume verification token |
| `resendVerificationEmail: Boolean!` | Authenticated | Writes a new token and a `SEND_EMAIL` outbox row when the account is still unverified |
| `requestPasswordReset(email: String!): Boolean!` | Public | Always returns true |
| `resetPassword(input: ResetPasswordInput!): Boolean!` | Public | Set password and destroy sessions |
| `changePassword(input: ChangePasswordInput!): Boolean!` | Authenticated | Rotate password, keep current session, destroy the others |

```graphql
input RegisterInput {
  username: String!
  fullName: String!
  email: String!
  password: String!
  preferredLanguage: InterfaceLanguage!
}

input LoginInput {
  email: String!
  password: String!
}

input ResetPasswordInput {
  token: String!
  newPassword: String!
}

input ChangePasswordInput {
  currentPassword: String!
  newPassword: String!
}
```

Limits: username 3–30 and pattern `[A-Za-z0-9_]`; full name 1–100; email at most 320; password 10–128.

---

## 4. Users module

Resolver: `UsersResolver`.

| Operation | Guard | Purpose |
| --- | --- | --- |
| `me: Account` | Public | Null when anonymous |
| `userProfile(username: String!): UserProfile!` | Public | Privacy-filtered profile shell |
| `followers(username: String!, cursor: String, pageSize: Int): UserConnection!` | Public | Hidden when the profile is private and the viewer is not the owner |
| `following(username: String!, cursor: String, pageSize: Int): UserConnection!` | Public | Same privacy rule |
| `updateProfile(input: UpdateProfileInput!): Account!` | Authenticated | Owner only |
| `updatePreferences(input: UpdatePreferencesInput!): UserPreferences!` | Authenticated | Owner only |
| `updatePrivacy(input: UpdatePrivacyInput!): Account!` | Authenticated | Owner only |
| `followUser(username: String!): UserProfile!` | Verified | Idempotent. Rejects self-follow |
| `unfollowUser(username: String!): UserProfile!` | Verified | Idempotent. Confirmed Q-22 option A: detach `NEW_FOLLOWER`, keep the snapshot, then delete the follow |
| `setFavoriteGenres(genreIds: [UUID!]!): [Genre!]!` | Verified | Replaces the set. Maximum 20 |
| `setFavoritePersons(input: [FavoritePersonInput!]!): [FavoritePerson!]!` | Verified | Replaces the set. Maximum 50 |
| `requestAvatarUpload(input: UploadRequestInput!): UploadIntent!` | Authenticated | Presigned PUT |
| `confirmAvatarUpload(objectKey: String!): Account!` | Authenticated | Stores the public URL after a successful upload |

```graphql
input UpdateProfileInput {
  fullName: String
  bio: String
  countryCode: String
  preferredLanguage: InterfaceLanguage
  username: String
}

input UpdatePrivacyInput {
  profileVisibility: ProfileVisibility!
  libraryVisibility: LibraryVisibility!
}

input FavoritePersonInput {
  personId: UUID!
  capacity: PersonCapacity!
}

type FavoritePerson {
  person: Person!
  capacity: PersonCapacity!
}

input UpdatePreferencesInput {
  showSpoilers: Boolean
  notifyNewFollower: Boolean
  notifyReviewLike: Boolean
  notifyDiscussionLike: Boolean
  notifyCommentReply: Boolean
  notifyNewComment: Boolean
  notifyClubInvitation: Boolean
  notifyClubMembership: Boolean
  notifyClubActivity: Boolean
  notifyClubAnnouncement: Boolean
}

input UploadRequestInput {
  contentType: String!
  byteSize: Int!
}

enum PersonCapacity { AUTHOR DIRECTOR }

type UploadIntent {
  uploadUrl: String!
  objectKey: String!
  expiresAt: DateTime!
}
```

Profile sections from the specification are queries, not embedded unbounded lists:

| Section | Operation |
| --- | --- |
| Overview | `userProfile` |
| Library | `userLibrary` |
| Reviews | `reviews(authorUsername)` |
| Discussions | `discussions(authorUsername)` |
| Activity | `userActivity` |
| Statistics | `userStatistics` |
| Followers and following | `followers`, `following` |

---

## 5. Catalog module

Resolvers: `WorksResolver`, `BooksResolver`, `MoviesResolver`, `SeriesResolver`, all inside `CatalogModule`.

```graphql
type Work {
  id: UUID!
  type: WorkType!
  originalTitle: String!
  description: String
  localizedTitle(language: String): String
  localizations: [WorkLocalization!]!
  posterUrl: String
  releaseDate: Date
  originalLanguage: String
  averageRating: Float!
  ratingsCount: Int!
  genres: [Genre!]!
  bookDetails: BookDetails
  movieDetails: MovieDetails
  tvSeriesDetails: TvSeriesDetails
  credits: [WorkCredit!]!
  videos: [WorkVideo!]!
  characters: [Character!]!
  viewerRating: Int
  viewerLibraryItem: LibraryItem
}

type WorkLocalization {
  languageCode: String!
  title: String!
  description: String
}

type BookDetails {
  isbn: String
  publisher: String
  pageCount: Int
  edition: String
  seriesName: String
  seriesPosition: String
  subtitle: String
  language: String
}

type MovieDetails {
  runtimeMinutes: Int
  productionCountries: [String!]!
  productionCompanies: [String!]!
}

type TvSeriesDetails {
  firstAirDate: Date
  lastAirDate: Date
  numberOfSeasons: Int
  numberOfEpisodes: Int
  status: SeriesStatus!
}

enum SeriesStatus { RETURNING ENDED CANCELED PLANNED UNKNOWN }

type WorkCredit {
  person: Person!
  role: CreditRole!
  characterName: String
  displayOrder: Int!
}

enum CreditRole { AUTHOR DIRECTOR WRITER ACTOR CREATOR PRODUCER }

type Person {
  id: UUID!
  name: String!
  biography: String
  imageUrl: String
}

type Genre {
  id: UUID!
  slug: String!
  name(language: InterfaceLanguage!): String!
}

type Character {
  id: UUID!
  name: String!
  description: String
}

type WorkVideo {
  site: String!
  videoKey: String!
  videoType: String!
  name: String
}
```

`bookDetails` is null unless `type = BOOK`. The same rule applies to the other detail fields. Clients still receive a single `Work` for shared cards.

`Work` has no `viewerReaction`. The specification allows reactions on reviews, discussions, comments, and club posts. A catalog work is not one of those targets, and `reactions` has no `work_id`.

| Operation | Guard | Purpose |
| --- | --- | --- |
| `work(id: UUID!): Work!` | Public | Local record only. No provider call and no database write |
| `books(input: WorkBrowseInput!): WorkOffsetConnection!` | Public | Type is forced to `BOOK` |
| `movies(input: WorkBrowseInput!): WorkOffsetConnection!` | Public | Type is forced to `MOVIE` |
| `series(input: WorkBrowseInput!): WorkOffsetConnection!` | Public | Type is forced to `TV_SERIES` |
| `genres(language: InterfaceLanguage!): [Genre!]!` | Public | Canonical vocabulary |
| `refreshWork(id: UUID!): Work!` | Moderator | Enqueues an immediate metadata refresh |

```graphql
input WorkBrowseInput {
  page: Int! = 1
  pageSize: Int! = 20
  genreSlugs: [String!]
  yearFrom: Int
  yearTo: Int
  originalLanguage: String
  minimumRating: Float
  sort: WorkSort! = POPULAR
}

enum WorkSort { POPULAR RATING RELEASE_DATE RECENTLY_ADDED TITLE }
```

There is no public mutation that edits title, description, or credits. Creating a local work is `openExternalWork`. Refreshing one is the moderator mutation `refreshWork`, which inserts an outbox row and returns the current local work. Queries in this module do not write PostgreSQL (decision D-63).

---

## 6. Search module

Resolver: `SearchResolver`.

| Operation | Guard | Purpose |
| --- | --- | --- |
| `searchWorks(input: SearchWorksInput!): WorkSearchResult!` | Public | Local full text plus provider search |
| `search(input: GlobalSearchInput!): GlobalSearchResult!` | Public | Grouped search across the product |

```graphql
input SearchWorksInput {
  query: String!
  type: WorkType!
  page: Int! = 1
  pageSize: Int! = 20
  language: InterfaceLanguage!
}

type WorkSearchResult {
  nodes: [WorkSearchHit!]!
  pageInfo: OffsetPageInfo!
  externalSearchSkipped: Boolean!
}

type WorkSearchHit {
  work: Work
  external: ExternalWorkHint
}

type ExternalWorkHint {
  provider: ExternalProvider!
  externalId: String!
  originalTitle: String!
  year: Int
  posterUrl: String
  authorsOrDirectors: [String!]!
}

enum ExternalProvider { GOOGLE_BOOKS TMDB_MOVIE TMDB_TV }

input GlobalSearchInput {
  query: String!
  limitPerGroup: Int! = 5
  language: InterfaceLanguage!
}

type GlobalSearchResult {
  works: [Work!]!
  users: [UserProfile!]!
  discussions: [Discussion!]!
  clubs: [Club!]!
}
```

Opening an external hit calls `openExternalWork(input: OpenExternalWorkInput!): Work!`. That mutation is public so a reader can materialize a catalog row before deciding to register. It is rate limited per IP. It upserts by `(provider, externalId)` and returns the local `Work`.

```graphql
input OpenExternalWorkInput {
  provider: ExternalProvider!
  externalId: String!
  language: InterfaceLanguage!
}
```

`search` does not return private clubs, removed content, or email addresses. User search matches username and full name only. `search` and `searchWorks` do not insert works.

Provider failures set `externalSearchSkipped` and still return local hits. They do not fail the whole query when local data exists. The Redis search cache is the only write a search query may perform.

---

## 7. Library module

Resolver: `LibraryResolver`.

| Operation | Guard | Purpose |
| --- | --- | --- |
| `myLibrary(input: LibraryFilterInput!): LibraryConnection!` | Authenticated | Owner library, including private notes |
| `userLibrary(username: String!, input: LibraryFilterInput!): LibraryConnection!` | Public | Respects library and profile visibility |
| `addToLibrary(input: AddToLibraryInput!): LibraryItem!` | Verified | Idempotent when the row already exists |
| `updateLibraryItem(input: UpdateLibraryItemInput!): LibraryItem!` | Verified | Status, dates, progress, notes, optional rating |
| `removeFromLibrary(workId: UUID!): Boolean!` | Verified | Deletes completion activities for that item, then the library row. Does not delete the work or the rating |

```graphql
type LibraryItem {
  id: UUID!
  work: Work!
  status: LibraryStatus!
  startDate: Date
  completionDate: Date
  currentPage: Int
  currentSeason: Int
  currentEpisode: Int
  progressConflict: Boolean!
  notes: String
  createdAt: DateTime!
  updatedAt: DateTime!
}

input LibraryFilterInput {
  type: WorkType
  status: LibraryStatus
  cursor: String
  pageSize: Int! = 20
}

input AddToLibraryInput {
  workId: UUID!
  status: LibraryStatus!
}

input UpdateLibraryItemInput {
  workId: UUID!
  status: LibraryStatus
  startDate: Date
  completionDate: Date
  currentPage: Int
  currentSeason: Int
  currentEpisode: Int
  notes: String
  rating: Int
  clearRating: Boolean
}
```

`progressConflict` is `library_items.progress_conflict`. Confirmed Q-24 option A: when a refresh lowers `page_count` or `number_of_seasons` below the stored progress, the flag becomes true and the page, season, episode, and status stay as the user saved them. A user update that brings progress back within the total clears the flag. Milestone 3 does not write this column. Milestone 4 writes it in the same refresh transaction.

`notes` is omitted from `userLibrary` unless the viewer owns the row. `rating` and `clearRating` are applied by `RatingsService` in the same transaction. They cannot both be set.

Illegal status and progress values return `VALIDATION` before the database trigger is reached. The trigger remains the backstop.

Marking a book or series `COMPLETED`, or a movie `WATCHED`, sets `completionDate` to today when the client omits it.

---

## 8. Reviews and ratings module

Resolver: `ReviewsResolver`.

| Operation | Guard | Purpose |
| --- | --- | --- |
| `review(id: UUID!): Review!` | Public | Private reviews are visible to the author and moderators |
| `reviews(input: ReviewFilterInput!): ReviewConnection!` | Public | Work page, profile, or the caller's own reviews |
| `createReview(input: CreateReviewInput!): Review!` | Verified | One active review per user and work |
| `updateReview(id: UUID!, input: UpdateReviewInput!): Review!` | Verified | Author only, unless the review is moderator-locked |
| `deleteReview(id: UUID!): Boolean!` | Verified | Author soft-deletes |
| `setRating(workId: UUID!, value: Int!): Work!` | Verified | Upsert 1–10 |
| `clearRating(workId: UUID!): Work!` | Verified | Removes the personal rating |

```graphql
type Review {
  id: UUID!
  author: UserProfile!
  work: Work!
  title: String
  content: String!
  containsSpoilers: Boolean!
  visibility: ContentVisibility!
  status: ContentStatus!
  commentCount: Int!
  reactionCount: Int!
  viewerReaction: ReactionType
  createdAt: DateTime!
  updatedAt: DateTime!
}

input ReviewFilterInput {
  workId: UUID
  authorUsername: String
  sort: ReviewSort! = NEWEST
  cursor: String
  pageSize: Int! = 20
}

enum ReviewSort { NEWEST OLDEST POPULAR }

input CreateReviewInput {
  workId: UUID!
  title: String
  content: String!
  containsSpoilers: Boolean! = false
  visibility: ContentVisibility! = PUBLIC
}

input UpdateReviewInput {
  title: String
  content: String
  containsSpoilers: Boolean
  visibility: ContentVisibility
}
```

Hidden and removed reviews are absent from public connections. Moderators can load them through the moderation module.

---

## 9. Discussions module

Resolver: `DiscussionsResolver`.

| Operation | Guard | Purpose |
| --- | --- | --- |
| `discussionCategories(language: InterfaceLanguage!): [DiscussionCategory!]!` | Public | Extensible lookup |
| `discussions(input: DiscussionFilterInput!): DiscussionConnection!` | Public | Filters and sorts |
| `discussion(id: UUID!): Discussion!` | Public | One thread |
| `createDiscussion(input: CreateDiscussionInput!): Discussion!` | Verified | Work or general |
| `updateDiscussion(id: UUID!, input: UpdateDiscussionInput!): Discussion!` | Verified | Author only |
| `deleteDiscussion(id: UUID!): Boolean!` | Verified | Author soft-deletes |

```graphql
type DiscussionCategory {
  id: UUID!
  slug: String!
  name: String!
}

type Discussion {
  id: UUID!
  author: UserProfile!
  title: String!
  content: String!
  type: DiscussionType!
  category: DiscussionCategory!
  relatedWork: Work
  relatedCharacter: Character
  containsSpoilers: Boolean!
  status: ContentStatus!
  commentCount: Int!
  reactionCount: Int!
  viewerReaction: ReactionType
  createdAt: DateTime!
  updatedAt: DateTime!
}

input DiscussionFilterInput {
  categorySlug: String
  workId: UUID
  authorUsername: String
  query: String
  sort: DiscussionSort! = NEWEST
  cursor: String
  pageSize: Int! = 20
}

enum DiscussionSort { NEWEST POPULAR }

input CreateDiscussionInput {
  title: String!
  content: String!
  type: DiscussionType!
  categoryId: UUID!
  relatedWorkId: UUID
  relatedCharacterId: UUID
  containsSpoilers: Boolean! = false
}

input UpdateDiscussionInput {
  title: String
  content: String
  categoryId: UUID
  containsSpoilers: Boolean
}
```

`type = WORK` requires `relatedWorkId`. `type = GENERAL` rejects both relation ids. `UpdateDiscussionInput` does not change `type`, `relatedWorkId`, or `relatedCharacterId`. Those fields define the discussion shape already enforced at insert.

---

## 10. Comments module

Resolver: `CommentsResolver`.

| Operation | Guard | Purpose |
| --- | --- | --- |
| `comments(input: CommentThreadInput!): CommentConnection!` | Public | One page of a thread. Replies are nested only within the returned page's parents, up to depth 3 |
| `createComment(input: CreateCommentInput!): Comment!` | Verified | Root or reply |
| `updateComment(id: UUID!, content: String!, containsSpoilers: Boolean!): Comment!` | Verified | Author only |
| `deleteComment(id: UUID!): Boolean!` | Verified | Author soft-deletes |

```graphql
type Comment {
  id: UUID!
  author: UserProfile!
  content: String!
  containsSpoilers: Boolean!
  status: ContentStatus!
  depth: Int!
  parentId: UUID
  viewerReaction: ReactionType
  reactionCount: Int!
  replies(cursor: String, pageSize: Int): CommentConnection!
  createdAt: DateTime!
  updatedAt: DateTime!
}

input CommentThreadInput {
  discussionId: UUID
  reviewId: UUID
  clubPostId: UUID
  cursor: String
  pageSize: Int! = 20
}

input CreateCommentInput {
  discussionId: UUID
  reviewId: UUID
  clubPostId: UUID
  parentCommentId: UUID
  content: String!
  containsSpoilers: Boolean! = false
}
```

Exactly one target id is required. A reply does not repeat a different target. Depth greater than 3 returns `VALIDATION`. Commenting on a private club post requires membership. Commenting on a private review is limited to the review author.

The `replies` field uses a DataLoader keyed by parent id so a page of comments does not issue one query per parent.

---

## 11. Reactions module

Resolver: `ReactionsResolver`.

| Operation | Guard | Purpose |
| --- | --- | --- |
| `addReaction(input: ReactionInput!): ReactionState!` | Verified | Insert or replace the viewer's one reaction |
| `removeReaction(input: ReactionTargetInput!): ReactionState!` | Verified | Idempotent delete |

```graphql
input ReactionInput {
  type: ReactionType!
  reviewId: UUID
  discussionId: UUID
  commentId: UUID
  clubPostId: UUID
}

input ReactionTargetInput {
  reviewId: UUID
  discussionId: UUID
  commentId: UUID
  clubPostId: UUID
}

type ReactionState {
  reactionCount: Int!
  viewerReaction: ReactionType
}
```

`LIKE` on a review or discussion writes a `CREATE_NOTIFICATION` outbox row in the same transaction as the reaction. The worker inserts the notification after commit. A repeated delivery with the same `dedupe_key` does not insert a second row. Other reaction types do not write that outbox row. `Comment.reactionCount` is `comments.reaction_count`.

---

## 12. Clubs module

Resolver: `ClubsResolver`.

| Operation | Guard | Purpose |
| --- | --- | --- |
| `clubs(input: ClubBrowseInput!): ClubOffsetConnection!` | Public | Public active clubs |
| `club(slug: String!): Club!` | Public | Public club, or private club when the viewer is a member |
| `myClubs(cursor: String, pageSize: Int): ClubConnection!` | Authenticated | Memberships of the caller |
| `clubMembers(slug: String!, input: MemberFilterInput!): MembershipConnection!` | Membership-aware | Private member lists require membership |
| `clubPosts(slug: String!, cursor: String, pageSize: Int): ClubPostConnection!` | Membership-aware | |
| `clubActivities(slug: String!, cursor: String, pageSize: Int): ClubActivityConnection!` | Membership-aware | |
| `createClub(input: CreateClubInput!): Club!` | Verified | Creator becomes owner |
| `updateClub(slug: String!, input: UpdateClubInput!): Club!` | Verified | Owner or club admin |
| `deleteClub(slug: String!): Boolean!` | Verified | Owner. Soft-deletes |
| `joinClub(slug: String!): ClubMembership!` | Verified | `OPEN` policy only |
| `requestClubMembership(slug: String!): ClubMembership!` | Verified | `APPROVAL` policy |
| `reviewMembershipRequest(input: ReviewMembershipInput!): ClubMembership!` | Verified | Club admin or owner |
| `inviteToClub(input: InviteToClubInput!): ClubInvitation!` | Verified | Club admin or owner |
| `respondToInvitation(input: RespondToInvitationInput!): ClubMembership!` | Verified | Invitee |
| `leaveClub(slug: String!): Boolean!` | Verified | Rejected for the current owner |
| `removeClubMember(input: MemberRoleInput!): Boolean!` | Verified | Club admin or owner. Cannot remove the owner |
| `changeClubMemberRole(input: ChangeMemberRoleInput!): ClubMembership!` | Verified | Owner manages admins. Admins cannot grant `OWNER` or `ADMIN` |
| `transferClubOwnership(slug: String!, username: String!): Club!` | Verified | Owner only. One transaction demotes the current owner to `ADMIN`, promotes an existing active member to `OWNER`, and sets `clubs.owner_id`. A deferred trigger checks the match at commit |
| `createClubPost(input: ClubPostInput!): ClubPost!` | Verified | Member. Announcements require club moderator or higher |
| `updateClubPost(id: UUID!, input: ClubPostInput!): ClubPost!` | Verified | Author, or club moderator for moderation edits of status through the moderation module |
| `deleteClubPost(id: UUID!): Boolean!` | Verified | Author or club moderator |
| `createClubActivity(input: ClubActivityInput!): ClubActivity!` | Verified | Club admin |
| `updateClubActivity(id: UUID!, input: ClubActivityInput!): ClubActivity!` | Verified | Club admin |
| `cancelClubActivity(id: UUID!): ClubActivity!` | Verified | Club admin |
| `requestClubImageUpload(input: ClubImageUploadInput!): UploadIntent!` | Verified | Owner or club admin |
| `confirmClubImageUpload(input: ConfirmClubImageInput!): Club!` | Verified | Owner or club admin |

```graphql
type Club {
  id: UUID!
  name: String!
  slug: String!
  description: String!
  avatarUrl: String
  coverUrl: String
  type: ClubType!
  visibility: ClubVisibility!
  membershipPolicy: MembershipPolicy!
  owner: UserProfile!
  memberCount: Int!
  viewerMembership: ClubMembership
  createdAt: DateTime!
}

type ClubMembership {
  id: UUID!
  user: UserProfile!
  role: ClubRole!
  status: MembershipStatus!
  joinedAt: DateTime
}

type ClubInvitation {
  id: UUID!
  club: Club!
  invitedBy: UserProfile!
  status: InvitationStatus!
  expiresAt: DateTime!
}

enum InvitationStatus { PENDING ACCEPTED DECLINED EXPIRED REVOKED }

type ClubPost {
  id: UUID!
  club: Club!
  author: UserProfile!
  postType: ClubPostType!
  title: String!
  content: String!
  containsSpoilers: Boolean!
  commentCount: Int!
  reactionCount: Int!
  viewerReaction: ReactionType
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum ClubPostType { DISCUSSION ANNOUNCEMENT }

type ClubActivity {
  id: UUID!
  title: String!
  description: String!
  type: ClubActivityType!
  relatedWork: Work
  startsAt: DateTime!
  endsAt: DateTime
  status: ClubActivityStatus!
  createdBy: UserProfile!
}

enum ClubActivityType {
  READING_CHALLENGE
  WATCHING_EVENT
  BOOK_SELECTION
  MOVIE_SELECTION
  DISCUSSION_EVENT
  GENERAL_EVENT
}

enum ClubActivityStatus { SCHEDULED ACTIVE COMPLETED CANCELLED }

input CreateClubInput {
  name: String!
  description: String!
  type: ClubType!
  visibility: ClubVisibility!
  membershipPolicy: MembershipPolicy!
}

input ClubBrowseInput {
  type: ClubType
  query: String
  sort: ClubSort! = POPULAR
  page: Int! = 1
  pageSize: Int! = 20
}

enum ClubSort { POPULAR NEWEST }

input UpdateClubInput {
  name: String
  description: String
  visibility: ClubVisibility
  membershipPolicy: MembershipPolicy
}

input MemberFilterInput {
  status: MembershipStatus
  cursor: String
  pageSize: Int! = 20
}

input ReviewMembershipInput {
  membershipId: UUID!
  accept: Boolean!
}

input InviteToClubInput {
  slug: String!
  username: String!
}

input RespondToInvitationInput {
  invitationId: UUID!
  accept: Boolean!
}

input MemberRoleInput {
  slug: String!
  username: String!
}

input ChangeMemberRoleInput {
  slug: String!
  username: String!
  role: ClubRole!
}

input ClubPostInput {
  slug: String!
  postType: ClubPostType!
  title: String!
  content: String!
  containsSpoilers: Boolean! = false
}

input ClubActivityInput {
  slug: String!
  title: String!
  description: String!
  type: ClubActivityType!
  relatedWorkId: UUID
  startsAt: DateTime!
  endsAt: DateTime
}

input ClubImageUploadInput {
  slug: String!
  kind: ClubImageKind!
  contentType: String!
  byteSize: Int!
}

enum ClubImageKind { AVATAR COVER }

input ConfirmClubImageInput {
  slug: String!
  kind: ClubImageKind!
  objectKey: String!
}
```

Role rules enforced in `ClubAccessService`:

| Action | Owner | Admin | Moderator | Member |
| --- | --- | --- | --- | --- |
| Edit settings, images, delete club | yes | settings and images only | no | no |
| Transfer ownership | yes | no | no | no |
| Change roles, remove members | yes | members below admin | no | no |
| Review requests and invitations | yes | yes | no | no |
| Create activities | yes | yes | no | no |
| Moderate posts and comments | yes | yes | yes | no |
| Create discussion posts | yes | yes | yes | yes |
| Create announcements | yes | yes | yes | no |

A user cannot change their own role. Private club fields never appear in a public connection.

---

## 13. Activity module

Resolver: `ActivityResolver`.

| Operation | Guard | Purpose |
| --- | --- | --- |
| `homeFeed(cursor: String, pageSize: Int, filter: FeedFilter): ActivityConnection!` | Verified | Followed users and joined clubs |
| `userActivity(username: String!, cursor: String, pageSize: Int): ActivityConnection!` | Public | Subject to profile privacy |

```graphql
type UserActivity {
  id: UUID!
  actor: UserProfile!
  type: ActivityType!
  work: Work
  review: Review
  discussion: Discussion
  club: Club
  clubPost: ClubPost
  clubActivity: ClubActivity
  createdAt: DateTime!
}

enum FeedFilter { ALL LIBRARY REVIEWS DISCUSSIONS CLUBS }
```

`work` is loaded from `user_activities.work_id`. `clubPost` and `clubActivity` are loaded from their foreign keys. `club` is the joined club, including the club context stored beside a post or a club activity. The payload does not expose library notes, private reviews, or private club posts. A row whose subject is no longer visible is skipped, and the page is filled until `pageSize` visible rows are collected or the source is exhausted. The extra scan is bounded to three times the page size; if that is not enough, `hasNextPage` stays true and the cursor advances.

---

## 14. Notifications module

Resolver: `NotificationsResolver`.

| Operation | Guard | Purpose |
| --- | --- | --- |
| `notifications(cursor: String, pageSize: Int, unreadOnly: Boolean): NotificationConnection!` | Authenticated | Recipient only |
| `unreadNotificationCount: Int!` | Authenticated | Badge |
| `markNotificationAsRead(id: UUID!): Notification!` | Authenticated | Recipient only |
| `markAllNotificationsAsRead: Int!` | Authenticated | Returns the number updated |
| `deleteNotification(id: UUID!): Boolean!` | Authenticated | Recipient hard-deletes |
| `notificationReceived: Notification!` | Authenticated | Subscription |

```graphql
type Notification {
  id: UUID!
  type: NotificationType!
  actor: UserProfile
  isRead: Boolean!
  subjectDetached: Boolean!
  createdAt: DateTime!
  review: Review
  discussion: Discussion
  comment: Comment
  club: Club
  invitation: ClubInvitation
  membership: ClubMembership
  clubPost: ClubPost
  clubActivity: ClubActivity
}
```

There is no `work` field on `Notification`. A like on a review exposes `review`, and the work is `review.work`. A discussion like exposes `discussion.relatedWork`. `clubPost` and `clubActivity` match `club_post_id` and `club_activity_id`. `subjectDetached` is true after unfollow clears `follow_id`. Confirmed Q-22 option A keeps that notification, the actor, and the snapshot.

The subscription stream emits only rows for the session user. Preference flags that are off suppress insert, so the subscription does not need a second filter. The insert itself runs from the outbox worker, not from a query.

---

## 15. Recommendations module

Resolver: `RecommendationsResolver`. All operations are `Verified`, because they depend on the personal library and favorites. Anonymous visitors use popular catalog queries instead.

| Operation | Purpose |
| --- | --- |
| `recommendedWorks(type: WorkType!, limit: Int! = 12): [Work!]!` | Rule-based personal recommendations |
| `similarWorks(workId: UUID!, limit: Int! = 8): [Work!]!` | Shared genres and people |
| `similarUsers(limit: Int! = 8): [UserProfile!]!` | Shared high ratings. Private profiles are omitted |

`limit` maximum is 20. Results are cached per user for one hour and invalidated when the user rates a work, changes favorites, or changes the library.

---

## 16. Analytics module

Resolver: `AnalyticsResolver`.

| Operation | Guard | Purpose |
| --- | --- | --- |
| `myStatistics: UserStatistics!` | Authenticated | Owner dashboard |
| `userStatistics(username: String!): UserStatistics!` | Public | Only when that profile is public; library-derived numbers require a public library |

```graphql
type UserStatistics {
  completedBooks: Int!
  pagesRead: Int!
  booksByYear: [YearCount!]!
  booksByGenre: [GenreCount!]!
  averageBookRating: Float
  watchedMovies: Int!
  movieRuntimeMinutes: Int
  moviesByYear: [YearCount!]!
  moviesByGenre: [GenreCount!]!
  averageMovieRating: Float
  completedSeries: Int!
  watchingSeries: Int!
  libraryCount: Int!
  reviewCount: Int!
  discussionCount: Int!
  followerCount: Int!
  topGenres: [GenreCount!]!
  favoriteAuthors: [Person!]!
  favoriteDirectors: [Person!]!
}

type YearCount { year: Int! count: Int! }
type GenreCount { genre: Genre! count: Int! }
```

Unknown page counts and movie runtimes are omitted from sums rather than treated as zero. The response still counts the completed item. `movieRuntimeMinutes` is null when no watched movie has a runtime.

Series statistics in the MVP are `completedSeries` and `watchingSeries`. `seriesRuntimeMinutes` and a total-episodes field are absent. `current_season` and `current_episode` are a position in the library, not a count of episodes watched, and the MVP has no per-season episode list (decision D-64). The specification asks for those totals only when the data is tracked. Episode-by-episode tracking stays out of scope.

---

## 17. Moderation module

Resolver: `ModerationResolver`.

| Operation | Guard | Purpose |
| --- | --- | --- |
| `reportContent(input: ReportContentInput!): Report!` | Verified | One open report per reporter and target |
| `reports(input: ReportFilterInput!): ReportConnection!` | Moderator | Queue |
| `report(id: UUID!): Report!` | Moderator | Detail |
| `assignReport(id: UUID!): Report!` | Moderator | Assigns the caller |
| `resolveReport(input: ResolveReportInput!): Report!` | Moderator | Resolve or reject |
| `hideContent(input: ModerateContentInput!): Boolean!` | Moderator | Status `HIDDEN` |
| `restoreContent(input: ModerateContentInput!): Boolean!` | Moderator | Status `PUBLISHED` |
| `removeContent(input: ModerateContentInput!): Boolean!` | Moderator | Status `REMOVED` and moderation lock for reviews |
| `restrictUser(input: RestrictUserInput!): Boolean!` | Moderator | Posting or login restriction. Cannot target an administrator |
| `suspendUser(input: SuspendUserInput!): AccountSummary!` | Admin | Account status `SUSPENDED` and sessions destroyed |
| `reinstateUser(input: ReinstateUserInput!): AccountSummary!` | Admin | Clears suspension |
| `changeUserRole(input: ChangeUserRoleInput!): AccountSummary!` | Admin | Does not return `Account` |
| `adminUsers(input: AdminUserFilterInput!): AccountSummaryConnection!` | Admin | Email is included here because this is an administrative list |
| `failedOutboxMessages: [OutboxFailure!]!` | Admin | Permanently failed outbox rows. Payload is not returned |
| `retryFailedOutboxMessage(id: UUID!): Boolean!` | Admin | Re-enqueues that same row. Rejects a row that is not permanently failed |

```graphql
enum ContentTargetType { REVIEW DISCUSSION COMMENT CLUB_POST }

enum UserRestrictionType { POSTING_SUSPENDED LOGIN_SUSPENDED }

input ReportContentInput {
  targetType: ReportTargetType!
  targetId: UUID!
  reason: ReportReason!
  description: String
}

input ModerateContentInput {
  targetType: ContentTargetType!
  targetId: UUID!
  reason: String!
}

input RestrictUserInput {
  userId: UUID!
  restriction: UserRestrictionType!
  reason: String!
  expiresAt: DateTime
}

input SuspendUserInput {
  userId: UUID!
  reason: String!
}

input ReinstateUserInput {
  userId: UUID!
  reason: String!
}

input ChangeUserRoleInput {
  userId: UUID!
  role: AccountRole!
  reason: String!
}

input ResolveReportInput {
  id: UUID!
  status: ReportStatus!
  resolutionNote: String
}

input ReportFilterInput {
  status: ReportStatus
  cursor: String
  pageSize: Int! = 20
}

input AdminUserFilterInput {
  query: String
  role: AccountRole
  page: Int! = 1
  pageSize: Int! = 20
}

enum OutboxMessageType {
  SEND_EMAIL
  INVALIDATE_SESSIONS
  CREATE_NOTIFICATION
  REFRESH_WORK
}

type OutboxFailure {
  id: UUID!
  messageType: OutboxMessageType!
  dedupeKey: String!
  processingFailedAt: DateTime!
  processingError: String
}

type Report {
  id: UUID!
  reporter: UserProfile!
  targetType: ReportTargetType!
  reason: ReportReason!
  description: String
  status: ReportStatus!
  reportedUser: UserProfile
  review: Review
  discussion: Discussion
  comment: Comment
  clubPost: ClubPost
  createdAt: DateTime!
  resolvedAt: DateTime
}

enum ReportStatus { OPEN IN_REVIEW RESOLVED REJECTED }

type AccountSummary {
  id: UUID!
  username: String!
  email: String!
  role: AccountRole!
  accountStatus: String!
  emailVerifiedAt: DateTime
  createdAt: DateTime!
}
```

Exactly one of `reportedUser`, `review`, `discussion`, `comment`, and `clubPost` is non-null, matching the report's exclusive foreign key. Moderator queries resolve those targets even when their status is `HIDDEN` or `REMOVED`. Public queries still omit those rows.

`hideContent`, `restoreContent`, and `removeContent` accept only `ContentTargetType`. They cannot target a user. User actions use `RestrictUserInput`, `SuspendUserInput`, `ReinstateUserInput`, and `ChangeUserRoleInput`.

Every successful moderation mutation appends a `moderation_actions` row in the same transaction as the state change.

`AccountSummary` is not reachable from public profile queries. `Account` is not returned for another user.

---

## 18. Operation map for the main journeys

| Journey | Operations |
| --- | --- |
| Register and enter | `register`, `verifyEmail`, `updateProfile`, `setFavoriteGenres`, `setFavoritePersons` |
| Discover a book | `searchWorks`, `openExternalWork`, `work`, `addToLibrary` |
| Finish a book | `updateLibraryItem` with status, progress, and optional rating; optional `createReview` |
| Watch a movie | `searchWorks`, `openExternalWork`, `addToLibrary`, `updateLibraryItem`, `setRating`, `createReview` |
| Discuss | `createDiscussion`, `comments`, `createComment`, `addReaction` |
| Join a club | `clubs` or `search`, `club`, `joinClub` or `requestClubMembership` |
| Create a club | `createClub` |
| Social return visit | `homeFeed`, `notifications`, `notificationReceived` |
| Statistics | `myStatistics` |

---

## 19. Performance rules specific to the schema

- List fields are paginated. There is no unbounded `reviews: [Review!]!` on `Work`.
- Counts displayed on cards come from denormalized columns.
- Related authors, genres, and viewer state come from DataLoaders.
- `homeFeed` and `comments.replies` have explicit cost in the complexity estimator.
- Search does not call a provider while resolving nested fields. Provider access from a query happens once, in `searchWorks`. `openExternalWork` and the refresh worker are the only catalog writes.
- Queries do not insert outbox rows, activities, or notifications. `retryFailedOutboxMessage` reuses the existing row and does not insert another one. It does not return the payload.
- Anonymous catalog queries are cacheable at the HTTP layer only for `genres` and `discussionCategories`. Personalized fields such as `viewerRating` make `work` uncacheable by a shared CDN cache. The MVP does not put GraphQL responses behind a CDN.

---

## 20. Schema evolution

The MVP schema is additive. Removing a field waits through a deprecation window once clients exist. There is no URL version. Codegen on the web app is updated in the same change as the resolver.

This contract is part of the approved version 0.4 baseline. Generating the schema and installing `@nestjs/graphql` wait for the separate instruction to start Milestone 1.
