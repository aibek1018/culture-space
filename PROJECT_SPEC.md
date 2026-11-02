\# CULTURE SPACE

\## Product Requirements \& Business Specification



\*\*Document version:\*\* 1.0  

\*\*Project type:\*\* International Social Platform  

\*\*Status:\*\* Initial Product Specification  

\*\*Target audience:\*\* International users  

\*\*Supported interface languages:\*\* English and Russian



\---



\# 1. PROJECT OVERVIEW



\## 1.1. Product Description



CULTURE SPACE is an international social platform designed for people who love reading books, watching movies and TV series, and discussing cultural works.



The platform combines personal media tracking, social networking, reviews, ratings, thematic discussions, and community clubs.



Users can discover cultural works, maintain personal libraries, share opinions, participate in discussions, organize reading and watching activities, and connect with people who have similar cultural interests.



The platform should combine selected concepts from:



\- Goodreads — book tracking and reading communities.

\- Letterboxd — movie diaries, reviews, and social activity.

\- StoryGraph — reading statistics and recommendations.

\- Fable — book clubs and collaborative reading.



CULTURE SPACE must have its own product identity and should not be a direct clone of any existing platform.



\## 1.2. Product Vision



Create a single cultural environment where users can track what they read and watch, discover new works, exchange opinions, and participate in meaningful discussions.



The primary value is not simply tracking books and movies.



The primary value is connecting people through literature and cinema.



\## 1.3. Target Audience



CULTURE SPACE targets an international audience.



Potential users:



\- Book enthusiasts.

\- Movie enthusiasts.

\- Literature students.

\- Film enthusiasts.

\- Critics and reviewers.

\- Members of book clubs.

\- People interested in philosophy, literature, and cinema.

\- Users looking for people with similar cultural interests.



The platform should not be restricted to a particular country.



\## 1.4. Supported Languages



The initial interface must support:



\- English (en).

\- Russian (ru).



Requirements:



\- All interface text must support localization.

\- Users can change their preferred interface language.

\- User-generated content can be written in any language.

\- Books and movies must preserve their original titles.

\- Localized titles should be displayed when available.

\- Dates, numbers, and other locale-dependent values should follow the selected language.

\- The architecture should allow additional languages in the future.



Do not assume that every book or movie has both English and Russian metadata.



\## 1.5. Product Platforms



Initial release:



\- Responsive web application.

\- Desktop support.

\- Tablet support.

\- Mobile browser support.



Native mobile applications are not part of the initial release.



\---



\# 2. PRODUCT PRINCIPLES



The application must follow these principles:



1\. Social interaction is a core product feature.

2\. Books, movies, and TV series are equally important content categories.

3\. Every user has a personal cultural library.

4\. Users can express their opinions through reviews and discussions.

5\. Discussions should support meaningful conversations, not only short comments.

6\. Clubs should provide a structured environment for collaborative activities.

7\. User profiles should represent individual cultural preferences.

8\. The application should remain usable without requiring social interaction.

9\. The product should support international users.

10\. User privacy and content moderation must be considered from the beginning.



\---



\# 3. CORE PRODUCT MODULES



The application consists of the following business modules:



1\. Authentication and Authorization.

2\. Users and Profiles.

3\. Books Catalog.

4\. Movies Catalog.

5\. TV Series Catalog.

6\. Personal Library.

7\. Reviews and Ratings.

8\. Discussions.

9\. Comments and Reactions.

10\. Clubs and Memberships.

11\. Activity Feed.

12\. Notifications.

13\. Search and Discovery.

14\. Recommendations.

15\. Analytics and Statistics.

16\. Moderation and Administration.



\---



\# 4. AUTHENTICATION AND AUTHORIZATION



\## 4.1. Registration



Users must be able to register using:



\- Username.

\- Full name.

\- Email address.

\- Password.

\- Preferred interface language.



Registration requirements:



\- Username must be unique.

\- Email must be unique.

\- Password must satisfy security requirements.

\- Passwords must be hashed using Argon2.

\- Email verification is required.

\- Unverified accounts must have restricted access to selected features.



\## 4.2. Login



Users can authenticate using:



\- Email and password.



Authentication must use server-side sessions stored in Redis.



Requirements:



\- Secure session management.

\- HttpOnly cookies.

\- Secure cookie configuration in production.

\- Session expiration.

\- Logout and session invalidation.

\- Protection against brute-force attacks.

\- Password hashing and verification.



JWT must not be used as the primary authentication mechanism.



\## 4.3. Password Recovery



Users can request password recovery through email.



Business flow:



1\. User submits email address.

2\. System generates a secure, time-limited recovery token.

3\. Recovery instructions are sent to the email address.

4\. User opens the recovery link.

5\. User submits a new password.

6\. System validates the token.

7\. Password is updated.

8\. Previous sessions can be invalidated.



Recovery tokens must be single-use and expire automatically.



\## 4.4. User Roles



Initial roles:



\- USER

\- MODERATOR

\- ADMIN



Permissions:



\*\*USER\*\*

\- Manage own profile.

\- Manage personal library.

\- Publish reviews.

\- Create discussions.

\- Comment and react.

\- Create and join clubs.



\*\*MODERATOR\*\*

\- Moderate discussions and comments.

\- Review reported content.

\- Hide or remove content according to moderation policies.

\- Apply moderation restrictions.



\*\*ADMIN\*\*

\- Manage users.

\- Manage roles.

\- Manage platform configuration.

\- Manage moderation operations.

\- Access administrative analytics.



Use role-based access control.



\---



\# 5. USERS AND PROFILES



\## 5.1. User Profile



Each user has a public profile.



Profile information:



\- ID.

\- Username.

\- Full name.

\- Avatar.

\- Biography.

\- Preferred interface language.

\- Country (optional).

\- Registration date.

\- Profile visibility.

\- Favorite genres.

\- Favorite authors.

\- Favorite directors.



Private information such as email and authentication data must never be exposed through public GraphQL queries.



\## 5.2. Profile Sections



Public profile should contain:



1\. Overview.

2\. Personal Library.

3\. Reviews.

4\. Discussions.

5\. Activity.

6\. Statistics.

7\. Followers.

8\. Following.



\## 5.3. Following System



Users can follow and unfollow other users.



Business rules:



\- Users cannot follow themselves.

\- Duplicate follow relationships are forbidden.

\- Following and unfollowing must be idempotent where appropriate.

\- Followers and following lists must support pagination.

\- Private accounts may require follow approval in a future version.



\---



\# 6. CULTURAL WORKS CATALOG



\## 6.1. General Concept



Books, movies, and TV series are represented through a common domain concept called `Work`.



The Work entity contains shared information.



Type-specific information is stored in dedicated entities.



Work types:



\- BOOK

\- MOVIE

\- TV\_SERIES



This approach allows shared functionality for:



\- Personal libraries.

\- Ratings.

\- Reviews.

\- Discussions.

\- Favorites.

\- Recommendations.

\- Search.

\- Analytics.



\## 6.2. General Work Information



Common attributes:



\- ID.

\- Type.

\- Original title.

\- Localized titles.

\- Description.

\- Poster or cover image.

\- Release or publication date.

\- Genres.

\- External provider identifiers.

\- Average rating.

\- Number of ratings.

\- Created date.

\- Updated date.



\## 6.3. Books



Book-specific information:



\- Authors.

\- ISBN.

\- Publisher.

\- Publication date.

\- Page count.

\- Language.

\- Edition.

\- Series information, when available.



External integration:



Google Books API.



Features:



\- Search books.

\- Retrieve book details.

\- Retrieve authors and descriptions.

\- Retrieve covers.

\- Synchronize external metadata.

\- Cache external information locally.



Do not call Google Books API on every page request.



Persist relevant metadata locally.



\## 6.4. Movies



Movie-specific information:



\- Runtime.

\- Release date.

\- Original language.

\- Production countries.

\- Directors.

\- Writers.

\- Cast.

\- Genres.

\- Production companies.

\- Trailer information.



External integration:



TMDB API.



Features:



\- Search movies.

\- Retrieve movie details.

\- Retrieve posters.

\- Retrieve cast and crew.

\- Retrieve genres.

\- Retrieve trailers.

\- Synchronize metadata locally.



\## 6.5. TV Series



Series-specific information:



\- First air date.

\- Last air date.

\- Number of seasons.

\- Number of episodes.

\- Status.

\- Original language.

\- Cast.

\- Creators.

\- Genres.



Additional entities may include:



\- Season.

\- Episode.



The initial release must support series tracking.



Detailed episode-by-episode progress tracking is optional and may be implemented after the core functionality.



\## 6.6. External Metadata Synchronization



Requirements:



\- External API identifiers must be unique within their provider.

\- External API calls must be isolated in integration modules.

\- API responses must be validated.

\- Implement timeouts and appropriate retry policies.

\- Handle rate limits.

\- Cache frequently accessed metadata.

\- Handle missing metadata gracefully.

\- Never make the application dependent on external API availability for displaying already synchronized works.



The external provider must not become the source of user-generated content.



\---



\# 7. PERSONAL LIBRARY



\## 7.1. Overview



Every user has a personal library containing books, movies, and TV series.



A user can add works from the catalog to their library.



The library is private by default only if the user chooses private profile or library visibility settings. Otherwise, the library can be displayed publicly.



\## 7.2. Book Statuses



\- WANT\_TO\_READ

\- CURRENTLY\_READING

\- COMPLETED

\- ON\_HOLD

\- DROPPED



\## 7.3. Movie Statuses



\- WANT\_TO\_WATCH

\- WATCHED



\## 7.4. TV Series Statuses



\- WANT\_TO\_WATCH

\- WATCHING

\- COMPLETED

\- ON\_HOLD

\- DROPPED



\## 7.5. Library Item Information



Each library item may contain:



\- ID.

\- User ID.

\- Work ID.

\- Status.

\- Personal rating.

\- Start date.

\- Completion date.

\- Progress.

\- Personal notes.

\- Created date.

\- Updated date.



\## 7.6. Progress Tracking



Books:



\- Current page.

\- Total pages.



TV series:



\- Current season.

\- Current episode.



Movies:



\- Watched or not watched.



Progress must never exceed the known total.



If total page count or episode count is unavailable, progress tracking should remain optional.



\## 7.7. Library Business Rules



1\. A user cannot add the same work to their library more than once.

2\. A user can change the status of an existing library item.

3\. A user can remove a work from their library.

4\. Removing a library item must not delete the actual Work entity.

5\. Users can change personal ratings independently of global ratings.

6\. Completion dates must be valid.

7\. Start dates must not be later than completion dates.

8\. Progress values must be validated.

9\. Library items must be scoped to the authenticated user.



\---



\# 8. REVIEWS AND RATINGS



\## 8.1. Reviews



Users can publish reviews for books, movies, and TV series.



Review fields:



\- ID.

\- Author.

\- Work.

\- Title (optional).

\- Content.

\- Contains spoilers.

\- Visibility.

\- Created date.

\- Updated date.



Features:



\- Create review.

\- Edit own review.

\- Delete own review.

\- Read reviews.

\- Like reviews.

\- Comment on reviews.

\- Sort and filter reviews.



\## 8.2. Ratings



Rating scale:



1 to 10.



Requirements:



\- Only authenticated users can rate works.

\- A user can have one active rating per work.

\- Ratings can be updated.

\- Ratings can be removed.

\- Personal ratings must be stored separately from aggregated ratings.

\- Average rating and rating count should be calculated efficiently.



The rating aggregation strategy must avoid unnecessary database recalculation on every catalog request.



Consider cached or denormalized aggregate values with a clear update strategy.



\## 8.3. Review Business Rules



\- A review belongs to exactly one user and one work.

\- A user cannot create duplicate active reviews for the same work.

\- Users can edit or delete only their own reviews.

\- Moderators and administrators can moderate reviews.

\- Spoiler information must be preserved.

\- Hidden or removed reviews must not appear in public feeds.



\---



\# 9. DISCUSSIONS



\## 9.1. Overview



Discussions are one of the primary features of CULTURE SPACE.



The platform must support two discussion formats.



\### Format A: Work-based Discussions



Discussions related to a specific cultural work.



Examples:



\- Is Raskolnikov morally responsible for his actions?

\- Why did Michael Corleone change throughout The Godfather?

\- Is the movie adaptation better than the original book?

\- What is the central idea of The Alchemist?



A discussion may reference:



\- A book.

\- A movie.

\- A TV series.

\- A character associated with a work.



\### Format B: General Topic Discussions



Discussions that are not tied to one specific work.



Examples:



\- Can literature change a person's worldview?

\- What makes a great antagonist?

\- Are modern movies losing their originality?

\- Which authors have influenced your life the most?



\## 9.2. Discussion Fields



\- ID.

\- Author.

\- Title.

\- Content.

\- Discussion type.

\- Related work (optional).

\- Related character (optional).

\- Category.

\- Contains spoilers.

\- Visibility.

\- Status.

\- Created date.

\- Updated date.



\## 9.3. Discussion Features



\- Create discussion.

\- Edit own discussion.

\- Delete own discussion.

\- View discussions.

\- Search discussions.

\- Filter by category.

\- Filter by work.

\- Sort by popularity and date.

\- Like discussions.

\- Comment.

\- Reply to comments.

\- Report inappropriate content.

\- Mark spoilers.



\## 9.4. Discussion Categories



Initial categories:



\- LITERATURE

\- CINEMA

\- PHILOSOPHY

\- CHARACTERS

\- ADAPTATIONS

\- RECOMMENDATIONS

\- GENERAL



Categories should be extensible.



\## 9.5. Discussion Rules



1\. Only authenticated users can create discussions.

2\. Each discussion must have an author.

3\. Work-based discussions must reference an existing Work.

4\. General discussions must not require a Work reference.

5\. Users can edit and delete their own discussions.

6\. Moderators can moderate discussions.

7\. Deleted discussions must not appear in public discovery.

8\. Discussions must support pagination.

9\. Comments must support nested replies.

10\. Spoiler protection must be supported.



\---



\# 10. COMMENTS AND REACTIONS



\## 10.1. Comments



Comments can belong to:



\- Discussions.

\- Reviews.

\- Club discussions.



Comments support nested replies.



Requirements:



\- Create comments.

\- Edit own comments.

\- Delete own comments.

\- Reply to comments.

\- Paginate comments.

\- Display comment author.

\- Display timestamps.

\- Support spoiler markers.



Use a consistent comment model where practical.



Do not allow unlimited recursive comment nesting.



The initial implementation should support a configurable maximum nesting depth, preferably 3 levels.



\## 10.2. Reactions



Users can react to:



\- Reviews.

\- Discussions.

\- Comments.

\- Club posts.



Initial reaction types:



\- LIKE

\- INSIGHTFUL

\- INTERESTING

\- DISAGREE



Business rules:



\- One reaction of a given type per user per target.

\- A user may change their reaction.

\- A user may remove their reaction.

\- Reaction counts must be calculated efficiently.



Use a polymorphic reaction model or another architecture that provides database integrity.



\---



\# 11. CLUBS AND COMMUNITIES



\## 11.1. Overview



Users can create and participate in book clubs and movie clubs.



Club types:



\- BOOK\_CLUB

\- MOVIE\_CLUB

\- MIXED\_CLUB



A mixed club can discuss books, movies, and TV series.



\## 11.2. Club Information



\- ID.

\- Name.

\- Description.

\- Avatar.

\- Cover image.

\- Club type.

\- Owner.

\- Visibility.

\- Membership policy.

\- Created date.

\- Updated date.



\## 11.3. Club Visibility



\- PUBLIC

\- PRIVATE



Public clubs:



\- Anyone can view club information.

\- Users can discover the club.

\- Membership follows the configured policy.



Private clubs:



\- Only approved members can access private discussions.

\- Club information may be restricted according to visibility settings.

\- Membership requires an invitation or approval.



\## 11.4. Club Roles



\- OWNER

\- ADMIN

\- MODERATOR

\- MEMBER



Permissions:



OWNER:

\- Full club control.

\- Manage administrators.

\- Transfer ownership.

\- Delete club.



ADMIN:

\- Manage members.

\- Moderate club content.

\- Create activities.

\- Manage club settings.



MODERATOR:

\- Moderate discussions and comments.

\- Manage reported content inside the club.



MEMBER:

\- Participate in discussions.

\- Join club activities.

\- Create permitted posts.



\## 11.5. Club Membership



Features:



\- Create club.

\- Join public club.

\- Request membership.

\- Accept or reject requests.

\- Invite users.

\- Leave club.

\- Remove members.

\- Change member roles.



Business rules:



1\. Club creator automatically becomes OWNER.

2\. A user cannot join the same club more than once.

3\. A club must always have an owner.

4\. A user cannot assign themselves an administrative role.

5\. Private club content must never be exposed to non-members.

6\. Membership changes must be authorized.



\## 11.6. Club Activities



Clubs can organize collaborative activities.



Examples:



\- Monthly book selection.

\- Reading schedules.

\- Weekly chapter discussions.

\- Movie nights.

\- Film discussions.

\- Polls for selecting the next book or movie.



Activity fields:



\- ID.

\- Club ID.

\- Title.

\- Description.

\- Related Work (optional).

\- Activity type.

\- Start date.

\- End date.

\- Status.

\- Created by.



Activity types:



\- READING\_CHALLENGE

\- WATCHING\_EVENT

\- BOOK\_SELECTION

\- MOVIE\_SELECTION

\- DISCUSSION\_EVENT

\- GENERAL\_EVENT



Users should be able to view upcoming and completed club activities.



Detailed progress synchronization between club members can be introduced in a later version.



\---



\# 12. ACTIVITY FEED



\## 12.1. Overview



The activity feed displays relevant activities from followed users and joined clubs.



Examples:



\- User completed a book.

\- User watched a movie.

\- User published a review.

\- User created a discussion.

\- User joined a club.

\- User reacted to content, where visibility permits.



\## 12.2. Feed Requirements



\- Personalized feed.

\- Chronological sorting.

\- Pagination.

\- Activity visibility rules.

\- Exclusion of deleted or moderated content.

\- Club membership access control.

\- Feed filtering.



The initial implementation should use a query-based feed.



Do not implement a complicated distributed feed architecture.



Feed entries should be derived from persisted activities or explicitly generated activity records.



\---



\# 13. NOTIFICATIONS



\## 13.1. Notification Types



\- NEW\_FOLLOWER

\- REVIEW\_LIKE

\- DISCUSSION\_LIKE

\- COMMENT\_REPLY

\- NEW\_COMMENT

\- CLUB\_INVITATION

\- CLUB\_MEMBERSHIP\_APPROVED

\- CLUB\_ACTIVITY\_CREATED

\- CLUB\_ANNOUNCEMENT



\## 13.2. Notification Features



\- View notifications.

\- Mark notification as read.

\- Mark all notifications as read.

\- Delete notifications.

\- Unread notification count.

\- Notification preferences.



\## 13.3. Technical Requirements



\- Store notifications in PostgreSQL.

\- Use Redis and BullMQ for asynchronous processing where appropriate.

\- Avoid duplicate notification generation.

\- Implement pagination.

\- Do not notify users about their own actions unless explicitly required.



Real-time notification delivery can use Socket.IO.



Notifications should still be persisted if the recipient is offline.



\---



\# 14. SEARCH AND DISCOVERY



\## 14.1. Global Search



Users should be able to search for:



\- Books.

\- Movies.

\- TV series.

\- Users.

\- Discussions.

\- Clubs.



\## 14.2. Filters



Works:



\- Type.

\- Genre.

\- Release or publication year.

\- Original language.

\- Rating.



Discussions:



\- Category.

\- Related work.

\- Author.

\- Creation date.

\- Popularity.



Clubs:



\- Club type.

\- Visibility.

\- Popularity.



\## 14.3. Discovery Pages



Create discovery sections:



\- Popular Books.

\- Popular Movies.

\- Popular TV Series.

\- Recently Added Works.

\- Trending Discussions.

\- Popular Clubs.

\- Recommended Works.



Use PostgreSQL full-text search or another justified search solution.



Do not introduce Elasticsearch or another search engine without a demonstrated need.



\---



\# 15. RECOMMENDATIONS



\## 15.1. Overview



The platform should provide recommendations based on user preferences and activity.



Initial recommendation signals:



\- Favorite genres.

\- Personal ratings.

\- Completed works.

\- Watch and reading lists.

\- Similar works.

\- Popularity.

\- User interaction history.



\## 15.2. Recommendation Features



\- Recommended books.

\- Recommended movies.

\- Recommended series.

\- Similar works.

\- Popular works in preferred genres.

\- Users with similar interests.



\## 15.3. Initial Implementation



Start with a rule-based recommendation system.



Do not introduce machine learning in the first release.



The recommendation engine must be isolated in its own module so that more sophisticated algorithms can be introduced later.



\---



\# 16. ANALYTICS AND STATISTICS



Each user should have a personal statistics dashboard.



\## 16.1. Reading Statistics



\- Total completed books.

\- Total pages read.

\- Books read by year.

\- Books by genre.

\- Average book rating.

\- Reading activity over time.



\## 16.2. Movie Statistics



\- Total watched movies.

\- Total watching time, when runtime is available.

\- Movies watched by year.

\- Movies by genre.

\- Average movie rating.



\## 16.3. TV Series Statistics



\- Completed series.

\- Currently watching series.

\- Total episodes watched, when tracked.

\- Total watching time, when data is available.



\## 16.4. General Statistics



\- Total works in personal library.

\- Total reviews.

\- Total discussions.

\- Total followers.

\- Most frequently used genres.

\- Favorite authors.

\- Favorite directors.

\- Activity history.



Statistics must be calculated using the user's own data and must respect profile privacy settings.



\---



\# 17. MODERATION AND REPORTING



Moderation is required because CULTURE SPACE is a user-generated content platform.



\## 17.1. Reporting



Users can report:



\- User profiles.

\- Reviews.

\- Discussions.

\- Comments.

\- Club content.



Report information:



\- ID.

\- Reporter.

\- Target.

\- Reason.

\- Description.

\- Status.

\- Assigned moderator.

\- Created date.

\- Resolution date.



Initial report reasons:



\- SPAM

\- HARASSMENT

\- HATE\_SPEECH

\- SPOILERS

\- INAPPROPRIATE\_CONTENT

\- COPYRIGHT

\- OTHER



\## 17.2. Moderation Actions



Moderators can:



\- Review reports.

\- Hide content.

\- Restore content.

\- Remove inappropriate content.

\- Restrict users according to moderation policy.

\- Record moderation actions.



All important moderation actions should be auditable.



\---



\# 18. MAIN USER JOURNEYS



\## 18.1. New User Registration



1\. User opens CULTURE SPACE.

2\. User selects interface language.

3\. User creates an account.

4\. User verifies email.

5\. User completes their profile.

6\. User selects favorite genres.

7\. User optionally selects favorite authors and directors.

8\. User enters the application.



\## 18.2. Discover and Add a Book



1\. User opens Books.

2\. User searches for a book.

3\. System retrieves results from local catalog and external integration.

4\. User opens a book page.

5\. User reviews book information.

6\. User adds the book to their personal library.

7\. User selects WANT\_TO\_READ.

8\. The book appears in their library.



\## 18.3. Complete a Book



1\. User opens their library.

2\. User selects a currently reading book.

3\. User updates reading progress.

4\. User marks the book as COMPLETED.

5\. User optionally provides a rating.

6\. User optionally publishes a review.

7\. The activity can appear in their social feed according to visibility settings.

8\. Personal statistics are updated.



\## 18.4. Watch a Movie



1\. User searches for a movie.

2\. User opens its details.

3\. User adds it to their watchlist.

4\. User later marks it as WATCHED.

5\. User assigns a rating.

6\. User optionally writes a review.

7\. Other users can interact with the review.



\## 18.5. Create a Discussion



1\. User opens Discussions.

2\. User selects discussion format.

3\. User enters title and content.

4\. User optionally attaches a book, movie, series, or character.

5\. User selects a category.

6\. User configures spoiler visibility.

7\. User publishes the discussion.

8\. Other users can comment and reply.

9\. Participants can react to comments.



\## 18.6. Join a Club



1\. User opens Clubs.

2\. User searches for a club.

3\. User opens club details.

4\. User requests membership or joins directly.

5\. Club administrators approve the request when required.

6\. User gains access to permitted club functionality.

7\. User participates in club activities.



\## 18.7. Create a Club



1\. User selects Create Club.

2\. User enters club name and description.

3\. User selects club type.

4\. User selects visibility.

5\. User configures membership policy.

6\. User creates the club.

7\. System assigns OWNER role to the creator.

8\. The club becomes available according to its visibility settings.



\---



\# 19. DOMAIN MODEL AND DATABASE REQUIREMENTS



Use PostgreSQL and TypeORM.



All primary keys should use UUID.



Use explicit database constraints, indexes, and foreign keys.



Avoid unnecessary ManyToMany relations when explicit junction entities are more appropriate.



\## 19.1. Core Entities



\### User



\- id

\- username

\- fullName

\- email

\- passwordHash

\- avatarUrl

\- bio

\- preferredLanguage

\- country

\- role

\- profileVisibility

\- emailVerifiedAt

\- createdAt

\- updatedAt



Constraints:

\- Unique username.

\- Unique email.

\- Password hash must never be exposed.



\### UserPreference



\- id

\- userId

\- preferredLanguage

\- favoriteGenres

\- notificationSettings

\- privacySettings



Use normalized relations for favorite genres when appropriate.



\### Work



Common representation of books, movies, and TV series.



\- id

\- type

\- originalTitle

\- description

\- posterUrl

\- releaseDate

\- originalLanguage

\- averageRating

\- ratingsCount

\- createdAt

\- updatedAt



\### WorkLocalizedTitle



\- id

\- workId

\- languageCode

\- title



Unique constraint:

\- workId + languageCode.



\### BookDetails



\- id

\- workId

\- isbn

\- publisher

\- pageCount

\- publicationDate



\### MovieDetails



\- id

\- workId

\- runtimeMinutes

\- releaseDate

\- originalLanguage



\### TVSeriesDetails



\- id

\- workId

\- firstAirDate

\- lastAirDate

\- numberOfSeasons

\- numberOfEpisodes

\- status



\### Author



\- id

\- name

\- biography

\- photoUrl



\### Director



\- id

\- name

\- biography

\- photoUrl



\### Person



A common representation of people involved in cultural works.



\- id

\- name

\- biography

\- imageUrl



\### WorkPerson



\- id

\- workId

\- personId

\- role

\- characterName

\- displayOrder



This entity supports authors, directors, actors, writers, and other contributors.



\### Genre



\- id

\- name

\- slug



\### WorkGenre



\- id

\- workId

\- genreId



Unique constraint:

\- workId + genreId.



\### ExternalWorkReference



\- id

\- workId

\- provider

\- externalId

\- lastSyncedAt



Unique constraint:

\- provider + externalId.



\### LibraryItem



\- id

\- userId

\- workId

\- status

\- personalRating

\- startDate

\- completionDate

\- currentProgress

\- totalProgress

\- notes

\- createdAt

\- updatedAt



Unique constraint:

\- userId + workId.



\### Review



\- id

\- userId

\- workId

\- title

\- content

\- containsSpoilers

\- status

\- createdAt

\- updatedAt



Unique constraint:

\- userId + workId for active reviews.



\### Discussion



\- id

\- userId

\- title

\- content

\- type

\- category

\- relatedWorkId

\- relatedCharacterId

\- containsSpoilers

\- status

\- createdAt

\- updatedAt



\### Comment



\- id

\- userId

\- discussionId (nullable)

\- reviewId (nullable)

\- clubPostId (nullable)

\- parentCommentId (nullable)

\- content

\- containsSpoilers

\- status

\- createdAt

\- updatedAt



Exactly one comment target must be specified.



\### Reaction



\- id

\- userId

\- targetType

\- targetId

\- reactionType

\- createdAt



A unique constraint should prevent duplicate reactions of the same type by the same user on the same target.



\### Follow



\- id

\- followerId

\- followingId

\- createdAt



Unique constraint:

\- followerId + followingId.



\### Club



\- id

\- name

\- slug

\- description

\- avatarUrl

\- coverUrl

\- type

\- visibility

\- membershipPolicy

\- ownerId

\- createdAt

\- updatedAt



\### ClubMembership



\- id

\- clubId

\- userId

\- role

\- status

\- joinedAt



Unique constraint:

\- clubId + userId.



\### ClubInvitation



\- id

\- clubId

\- invitedUserId

\- invitedById

\- status

\- expiresAt

\- createdAt



\### ClubActivity



\- id

\- clubId

\- title

\- description

\- type

\- relatedWorkId

\- startDate

\- endDate

\- status

\- createdById



\### ClubPost



\- id

\- clubId

\- authorId

\- title

\- content

\- containsSpoilers

\- status

\- createdAt

\- updatedAt



\### Notification



\- id

\- recipientId

\- actorId

\- type

\- targetType

\- targetId

\- isRead

\- createdAt



\### UserActivity



\- id

\- userId

\- activityType

\- targetType

\- targetId

\- visibility

\- createdAt



\### Report



\- id

\- reporterId

\- targetType

\- targetId

\- reason

\- description

\- status

\- assignedModeratorId

\- resolvedAt

\- createdAt



\### ModerationAction



\- id

\- moderatorId

\- targetType

\- targetId

\- actionType

\- reason

\- createdAt



\---



\# 20. ENTITY RELATIONSHIPS



The following relationships must be reflected in the ER diagram.



\## Users



\- User 1:N LibraryItem.

\- User 1:N Review.

\- User 1:N Discussion.

\- User 1:N Comment.

\- User 1:N Notification.

\- User 1:N Report.

\- User N:M User through Follow.

\- User N:M Work through LibraryItem.

\- User N:M Club through ClubMembership.



\## Works



\- Work 1:1 BookDetails (when type is BOOK).

\- Work 1:1 MovieDetails (when type is MOVIE).

\- Work 1:1 TVSeriesDetails (when type is TV\_SERIES).

\- Work 1:N WorkLocalizedTitle.

\- Work 1:N ExternalWorkReference.

\- Work N:M Genre through WorkGenre.

\- Work N:M Person through WorkPerson.

\- Work 1:N LibraryItem.

\- Work 1:N Review.

\- Work 1:N Discussion.



\## Discussions



\- Discussion 1:N Comment.

\- Comment 1:N Comment through parentCommentId.

\- User 1:N Discussion.

\- User 1:N Comment.



\## Clubs



\- Club 1:N ClubMembership.

\- Club 1:N ClubActivity.

\- Club 1:N ClubPost.

\- Club 1:N ClubInvitation.

\- ClubPost 1:N Comment.



The final database design must also define deletion behavior, foreign key constraints, and indexes.



For polymorphic relationships, explain how referential integrity will be maintained. Do not rely on unchecked polymorphic IDs without considering database integrity.



\---



\# 21. GRAPHQL API REQUIREMENTS



Use NestJS GraphQL Code First.



All business operations must be exposed through GraphQL.



Use:



\- Queries for reading data.

\- Mutations for modifying data.

\- Subscriptions only where real-time delivery is required.



Suggested GraphQL modules:



\- AuthResolver.

\- UsersResolver.

\- BooksResolver.

\- MoviesResolver.

\- SeriesResolver.

\- LibraryResolver.

\- ReviewsResolver.

\- DiscussionsResolver.

\- CommentsResolver.

\- ReactionsResolver.

\- ClubsResolver.

\- NotificationsResolver.

\- SearchResolver.

\- RecommendationsResolver.

\- AnalyticsResolver.

\- ModerationResolver.



Example queries:



\- me

\- userProfile

\- users

\- work

\- searchWorks

\- myLibrary

\- userLibrary

\- reviews

\- discussions

\- discussion

\- clubs

\- club

\- notifications

\- myStatistics

\- recommendations



Example mutations:



\- register

\- login

\- logout

\- updateProfile

\- followUser

\- unfollowUser

\- addToLibrary

\- updateLibraryItem

\- removeFromLibrary

\- createReview

\- updateReview

\- deleteReview

\- createDiscussion

\- updateDiscussion

\- deleteDiscussion

\- createComment

\- updateComment

\- deleteComment

\- addReaction

\- removeReaction

\- createClub

\- joinClub

\- leaveClub

\- createClubActivity

\- markNotificationAsRead

\- reportContent



These are conceptual operation names. The final schema must use consistent naming, typed inputs, outputs, and authorization rules.



\## GraphQL Technical Rules



\- Use GraphQL Code First.

\- Use @ObjectType and @InputType.

\- Keep resolvers thin.

\- Put business logic in services.

\- Avoid exposing TypeORM entities directly where this creates coupling.

\- Use DataLoader to prevent N+1 queries.

\- Implement cursor pagination for activity feeds and discussions.

\- Implement offset pagination where suitable for catalog browsing.

\- Validate query complexity and depth.

\- Limit pagination sizes.

\- Implement field-level authorization where needed.

\- Use GraphQL enums.

\- Ensure private club content is protected at the resolver/service level.



\---



\# 22. FRONTEND REQUIREMENTS



Use Next.js, React, TypeScript, Apollo Client, and Tailwind CSS.



The frontend should be responsive and support English and Russian.



\## Main Pages



\### Public Pages



\- Landing page.

\- Login.

\- Registration.

\- Email verification.

\- Password recovery.

\- Books catalog.

\- Movies catalog.

\- TV series catalog.

\- Public work details.

\- Public user profiles.

\- Public discussions.

\- Public clubs.



\### Authenticated Pages



\- Home feed.

\- My profile.

\- My library.

\- My reviews.

\- My discussions.

\- My clubs.

\- Notifications.

\- Recommendations.

\- Statistics.

\- Account settings.

\- Privacy settings.



\### Club Pages



\- Club overview.

\- Club members.

\- Club discussions.

\- Club activities.

\- Club settings.



\## UX Requirements



\- Modern, clean, content-focused interface.

\- Consistent design system.

\- Responsive layouts.

\- Loading states.

\- Empty states.

\- Error states.

\- Form validation.

\- Confirmation dialogs for destructive actions.

\- Pagination or infinite scrolling where appropriate.

\- Accessible controls.

\- Clear spoiler presentation.



The product should prioritize content readability and meaningful discussion.



Avoid excessive visual complexity.



\---



\# 23. TECHNICAL ARCHITECTURE



\## 23.1. Backend Stack



\- Node.js.

\- NestJS.

\- TypeScript.

\- GraphQL.

\- Apollo Server.

\- GraphQL Code First.

\- TypeORM.

\- PostgreSQL.

\- Redis.

\- BullMQ.

\- Socket.IO.

\- Passport.

\- Argon2.



\## 23.2. Frontend Stack



\- Next.js.

\- React.

\- TypeScript.

\- Apollo Client.

\- Tailwind CSS.

\- React Hook Form.

\- Zod.



\## 23.3. Infrastructure



\- Docker.

\- Docker Compose.

\- Nginx.

\- GitHub Actions.

\- GitHub Container Registry.

\- VPS running Linux.

\- MinIO for file storage.



\## 23.4. Architecture Style



Use Modular Monolith.



Do not introduce microservices in the initial version.



Each business module must have clear ownership of its domain logic.



Modules should communicate through explicit service interfaces or well-defined application-level contracts.



Avoid circular dependencies.



\---



\# 24. BACKEND MODULE STRUCTURE



Suggested structure:



src/

&#x20; common/

&#x20;   decorators/

&#x20;   guards/

&#x20;   filters/

&#x20;   interceptors/

&#x20;   scalars/

&#x20;   enums/

&#x20;   interfaces/



&#x20; config/



&#x20; database/

&#x20;   migrations/

&#x20;   seeds/



&#x20; modules/

&#x20;   auth/

&#x20;   users/

&#x20;   works/

&#x20;   books/

&#x20;   movies/

&#x20;   series/

&#x20;   genres/

&#x20;   persons/

&#x20;   library/

&#x20;   reviews/

&#x20;   discussions/

&#x20;   comments/

&#x20;   reactions/

&#x20;   follows/

&#x20;   clubs/

&#x20;   notifications/

&#x20;   activity-feed/

&#x20;   search/

&#x20;   recommendations/

&#x20;   analytics/

&#x20;   moderation/



&#x20; integrations/

&#x20;   google-books/

&#x20;   tmdb/



&#x20; infrastructure/

&#x20;   redis/

&#x20;   queues/

&#x20;   storage/

&#x20;   realtime/



&#x20; app.module.ts

&#x20; main.ts



The structure is a proposal. Final module boundaries must be validated against domain responsibilities.



\---



\# 25. SECURITY REQUIREMENTS



Security must be considered from the beginning.



Requirements:



\- Strict input validation.

\- Argon2 password hashing.

\- Secure session management.

\- Redis session storage.

\- HttpOnly cookies.

\- HTTPS in production.

\- Rate limiting.

\- GraphQL query depth limits.

\- GraphQL complexity limits.

\- Pagination limits.

\- Role-based access control.

\- Ownership validation.

\- Protection against unauthorized data access.

\- CORS configuration.

\- CSRF protection appropriate for cookie-based authentication.

\- Secure environment configuration.

\- No secrets committed to Git.

\- Safe logging.

\- Protection against spam and abusive behavior.



Never trust user IDs supplied by the client for ownership-sensitive operations.



Always derive the authenticated user from the validated session.



\---



\# 26. PERFORMANCE REQUIREMENTS



\- Use database indexes for frequently queried fields.

\- Prevent N+1 queries with DataLoader.

\- Use appropriate eager/lazy loading strategies.

\- Avoid unnecessary database joins.

\- Use pagination for collections.

\- Cache frequently accessed catalog metadata.

\- Use Redis with explicit cache invalidation.

\- Use BullMQ for suitable asynchronous operations.

\- Avoid synchronous external API calls in critical user-facing workflows.

\- Use database transactions for operations requiring atomicity.



Do not introduce caching or background processing without a justified use case.



\---



\# 27. DEVOPS AND CI/CD



\## 27.1. Docker



Use Docker for local development and production deployment.



Required services:



\- Backend.

\- Frontend.

\- PostgreSQL.

\- Redis.

\- MinIO.

\- Nginx.



Use:



\- Multi-stage Dockerfiles.

\- Production-specific configurations.

\- Docker Compose.

\- Health checks.

\- Persistent volumes.

\- Internal Docker networks.

\- Non-root application containers.

\- Environment-based configuration.



Do not expose PostgreSQL, Redis, or MinIO administration interfaces publicly without explicit security controls.



\## 27.2. CI/CD



Use GitHub Actions.



CI pipeline:



1\. Checkout source code.

2\. Install dependencies with pnpm.

3\. Run lint.

4\. Run TypeScript checks.

5\. Run unit tests.

6\. Run integration tests.

7\. Build backend.

8\. Build frontend.



CD pipeline:



1\. Build production Docker images.

2\. Tag images with Git commit SHA.

3\. Push images to GitHub Container Registry.

4\. Connect to VPS through SSH.

5\. Pull new images.

6\. Apply TypeORM migrations.

7\. Deploy using production Docker Compose.

8\. Verify health checks.

9\. Report deployment status.



Requirements:



\- Use GitHub Actions Secrets.

\- Keep production secrets on the server or in an appropriate secrets manager.

\- Never commit production credentials.

\- Maintain database backups.

\- Implement deployment recovery and rollback procedures.

\- Never delete persistent volumes during routine deployment.

\- Apply migrations in a controlled manner.

\- Do not claim zero-downtime deployment unless the infrastructure actually supports it.



\---



\# 28. FILE STORAGE



Use MinIO for application-managed files.



Potential files:



\- User avatars.

\- Club avatars.

\- Club covers.

\- User-uploaded images.



Requirements:



\- Private bucket configuration where appropriate.

\- File size limits.

\- MIME type validation.

\- Unique object names.

\- Safe upload handling.

\- Presigned URLs where suitable.

\- Deletion policies.

\- No public access to private files.



External book covers and movie posters should preferably use external metadata image URLs rather than being downloaded and duplicated unnecessarily.



\---



\# 29. TESTING REQUIREMENTS



Use Jest.



Testing layers:



\## Unit Tests



Test:



\- Services.

\- Business rules.

\- Domain validation.

\- Recommendation logic.

\- Permission checks.



\## Integration Tests



Test:



\- TypeORM repositories.

\- Database relationships.

\- Transactions.

\- Authentication and session behavior.

\- External integration clients.



\## E2E Tests



Test important GraphQL user journeys:



\- Registration and login.

\- Email verification.

\- Add book to library.

\- Complete a book.

\- Rate a movie.

\- Publish a review.

\- Create a discussion.

\- Reply to a comment.

\- Create a club.

\- Join a club.

\- Receive notifications.



Test authorization and privacy boundaries.



\---



\# 30. NON-FUNCTIONAL REQUIREMENTS



\## Reliability



\- Handle external API failures gracefully.

\- Persist important user-generated content.

\- Use transactions for multi-step database operations.

\- Implement health checks.



\## Maintainability



\- Strict TypeScript.

\- Clear module boundaries.

\- Consistent naming.

\- Documented business rules.

\- Automated tests.

\- Database migrations.



\## Scalability



\- Modular Monolith architecture.

\- Stateless application instances where practical.

\- Redis-backed sessions.

\- Background job processing.

\- Database indexing.

\- Efficient pagination.



\## Accessibility



\- Keyboard navigation.

\- Semantic HTML.

\- Accessible forms.

\- Appropriate color contrast.

\- Screen-reader-friendly controls.



\## Internationalization



\- English and Russian UI.

\- Unicode support.

\- Localized dates and numbers.

\- Original titles preserved.

\- User-generated content independent of interface language.



\---



\# 31. MVP SCOPE



The first release must include all three types of cultural works:



\- Books.

\- Movies.

\- TV series.



The MVP must include the following capabilities:



\### Authentication

\- Registration.

\- Login.

\- Logout.

\- Email verification.

\- Password recovery.



\### Users

\- User profiles.

\- Profile editing.

\- Following system.



\### Catalog

\- Books.

\- Movies.

\- TV series.

\- External API integrations.

\- Search and details.



\### Library

\- Add works.

\- Change statuses.

\- Track progress.

\- Personal ratings.

\- Personal notes.



\### Reviews

\- Create and manage reviews.

\- Ratings.

\- Likes.

\- Spoiler support.



\### Discussions

\- Work-based discussions.

\- General discussions.

\- Comments.

\- Nested replies.

\- Reactions.

\- Spoiler support.



\### Clubs

\- Create clubs.

\- Public and private clubs.

\- Membership.

\- Club roles.

\- Club discussions.

\- Basic club activities.



\### Social

\- User profiles.

\- Activity feed.

\- Notifications.



\### Discovery

\- Global search.

\- Popular works.

\- Popular discussions.

\- Basic recommendations.



\### Analytics

\- Personal reading statistics.

\- Movie statistics.

\- Series statistics.



\### Infrastructure

\- Docker.

\- PostgreSQL.

\- Redis.

\- MinIO.

\- GitHub Actions.

\- GHCR.

\- Production deployment.



\---



\# 32. FUTURE ENHANCEMENTS



These features are not mandatory for the first MVP.



Potential future functionality:



\- Native mobile applications.

\- Advanced recommendation algorithms.

\- AI-powered recommendations.

\- AI-assisted literary analysis.

\- Character relationship graphs.

\- Book versus movie comparison tools.

\- Advanced reading challenges.

\- Collaborative reading sessions.

\- Live club events.

\- Advanced real-time discussions.

\- Direct messaging.

\- Advanced moderation.

\- More interface languages.

\- Detailed TV episode tracking.

\- Public annual cultural reports.



Future features must not complicate the initial architecture unnecessarily.



\---



\# 33. PRODUCT SUCCESS CRITERIA



The initial release should be considered successful when:



1\. A user can register and manage an account.

2\. A user can discover books, movies, and TV series.

3\. A user can add works to a personal library.

4\. A user can track reading and watching progress.

5\. A user can rate and review works.

6\. A user can create and participate in discussions.

7\. Users can comment and reply to each other.

8\. Users can create and join clubs.

9\. Users can follow other users.

10\. Users can receive notifications.

11\. Users can view personal statistics.

12\. The application works in English and Russian.

13\. The application can be deployed using Docker.

14\. CI/CD successfully tests, builds, and deploys the application.

15\. Important business rules are covered by automated tests.



\---



\# 34. ARCHITECTURAL DECISIONS REQUIRING REVIEW



Before implementation, the Senior Software Architect must explicitly review:



1\. The shared Work entity and type-specific detail entities.

2\. The relationship between Work, BookDetails, MovieDetails, and TVSeriesDetails.

3\. The polymorphic design of reactions and notifications.

4\. The comment target and nesting architecture.

5\. The strategy for rating aggregation.

6\. The activity feed persistence strategy.

7\. The authentication and Redis session architecture.

8\. The privacy model for profiles, libraries, and clubs.

9\. The external API synchronization strategy.

10\. The TypeORM migration strategy.

11\. The Docker development and production architecture.

12\. The GitHub Actions deployment strategy.



For each important decision:



\- Explain the proposed approach.

\- Explain why it is appropriate.

\- Describe alternatives.

\- Identify potential disadvantages.

\- Highlight any security or scalability implications.



Do not silently make significant architectural decisions.



\---



\# 35. DEVELOPMENT RULES



The project must be developed incrementally.



Mandatory rules:



1\. Never use Prisma.

2\. Use TypeORM exclusively as the ORM.

3\. Use GraphQL Code First.

4\. Do not implement REST endpoints for business operations.

5\. Use strict TypeScript.

6\. Avoid any.

7\. Avoid unnecessary abstractions.

8\. Keep resolvers thin.

9\. Keep business logic in services.

10\. Use dependency injection.

11\. Use DTOs and GraphQL input types.

12\. Use TypeORM migrations.

13\. Never enable synchronize in production.

14\. Write tests for business-critical operations.

15\. Never overwrite existing files without inspecting them.

16\. Never install unnecessary dependencies.

17\. Never implement multiple unrelated milestones in one step.

18\. Update technical documentation when architecture changes.

19\. Keep naming conventions consistent.

20\. Communicate implementation decisions and trade-offs.



When requirements are ambiguous, ask for clarification instead of inventing business rules.



\---



\# 36. INITIAL DEVELOPMENT PROCESS



The project must be implemented through the following milestones.



\## Milestone 1 — Architecture and Foundation



\- Finalize architecture.

\- Finalize ER diagram.

\- Define module boundaries.

\- Define GraphQL API conventions.

\- Configure NestJS.

\- Configure TypeORM.

\- Configure PostgreSQL.

\- Configure GraphQL.

\- Configure Redis.

\- Configure environment validation.

\- Prepare Docker development environment.



\## Milestone 2 — Authentication and Users



\- User entity.

\- Registration.

\- Login and logout.

\- Redis sessions.

\- Email verification.

\- Password recovery.

\- User profiles.

\- User preferences.

\- Authorization.



\## Milestone 3 — Cultural Catalog



\- Work domain.

\- Book details.

\- Movie details.

\- TV series details.

\- Google Books integration.

\- TMDB integration.

\- Search.

\- Metadata synchronization.



\## Milestone 4 — Personal Library



\- Library entities.

\- Status management.

\- Progress tracking.

\- Personal ratings.

\- Personal notes.

\- Library queries.



\## Milestone 5 — Reviews and Ratings



\- Review management.

\- Rating management.

\- Rating aggregation.

\- Likes.

\- Spoiler protection.



\## Milestone 6 — Discussions and Comments



\- General discussions.

\- Work-based discussions.

\- Comments.

\- Nested replies.

\- Reactions.

\- Moderation foundations.



\## Milestone 7 — Clubs



\- Club management.

\- Membership.

\- Roles and permissions.

\- Invitations.

\- Club posts.

\- Club activities.



\## Milestone 8 — Social Features



\- Following.

\- Activity feed.

\- Notifications.

\- Basic real-time delivery.



\## Milestone 9 — Discovery and Analytics



\- Global search.

\- Recommendations.

\- Popular content.

\- Personal statistics.



\## Milestone 10 — Frontend Completion



\- Responsive application.

\- Localization.

\- Apollo Client integration.

\- All main pages.

\- Loading and error states.

\- Accessibility.



Frontend work may proceed in parallel with backend milestones once the relevant GraphQL contracts are stable.



\## Milestone 11 — Testing and Security



\- Unit tests.

\- Integration tests.

\- E2E tests.

\- Security review.

\- Performance review.

\- Authorization review.



\## Milestone 12 — Production and CI/CD



\- Production Dockerfiles.

\- Production Docker Compose.

\- Nginx.

\- HTTPS.

\- GitHub Actions.

\- GHCR.

\- VPS deployment.

\- Database backups.

\- Monitoring.

\- Recovery documentation.



\---



\# 37. FINAL INSTRUCTIONS TO THE DEVELOPMENT AGENT



This document is the primary source of product requirements for CULTURE SPACE.



Do not treat the project as a generic CRUD application.



The goal is to create a real social product with coherent business logic, reliable data relationships, secure user interactions, and a maintainable architecture.



Before implementing any application code:



1\. Read this entire specification.

2\. Analyze all modules and dependencies.

3\. Identify missing or conflicting requirements.

4\. Review the proposed domain model.

5\. Prepare a complete ER diagram.

6\. Prepare the architecture proposal.

7\. Prepare the GraphQL API design.

8\. Prepare the Docker and CI/CD architecture.

9\. Create DEVELOPMENT\_PLAN.md.

10\. Present architectural decisions and alternatives.



Do not generate application code, install dependencies, or create migrations during this initial analysis.



Wait for explicit approval before starting implementation.



All communication with the product owner must be in Russian.



All source code, identifiers, database names, API fields, and technical documentation must be in English.



The final objective is to build CULTURE SPACE as a maintainable, secure, international, production-oriented social platform for books, movies, TV series, and meaningful cultural discussions.

