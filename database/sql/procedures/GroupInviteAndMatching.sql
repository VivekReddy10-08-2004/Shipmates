USE Shipmates;

/*
   GROUP ↔ INDIVIDUAL MATCHING + INVITES
   ──────────────────────────────────────
   Adds:
     1. Group_Invite table (group owner invites a user to join)
     2. GetMatchingGroupsForUser   — for the StudyBuddy match page
     3. GetMatchingUsersForGroup   — for the group "Suggested Members" panel
     4. InviteUserToGroup          — owner sends an invite
     5. RespondToGroupInvite       — invited user accepts / rejects
     6. GetGroupInvitesForUser     — pending invites for a user
     7. GetGroupInvitesSentByGroup — who the owner has already invited

   Matching uses the group OWNER's Match_Profile as a proxy for the group's
   "vibe." Cheap to compute, no schema overhaul, "good enough" since the
   owner is usually the most active member and sets the tone.
*/

CREATE TABLE Group_Invite (
    invite_id          INT PRIMARY KEY AUTO_INCREMENT,
    group_id           INT NOT NULL,
    invited_user_id    INT NOT NULL,
    invited_by_user_id INT NOT NULL,
    invite_status      ENUM('pending', 'accepted', 'rejected', 'expired')
                       NOT NULL DEFAULT 'pending',
    created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at       DATETIME NULL,
    CONSTRAINT uq_group_invite UNIQUE (group_id, invited_user_id),
    CONSTRAINT fk_gi_group
        FOREIGN KEY (group_id) REFERENCES Study_Group(group_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_gi_invited
        FOREIGN KEY (invited_user_id) REFERENCES Users(user_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_gi_inviter
        FOREIGN KEY (invited_by_user_id) REFERENCES Users(user_id)
);

CREATE INDEX idx_gi_user_status  ON Group_Invite(invited_user_id, invite_status, created_at);
CREATE INDEX idx_gi_group_status ON Group_Invite(group_id, invite_status);


DELIMITER //

/* ─────────────────────────────────────────────────────────────────
   GetMatchingGroupsForUser
   Suggest public, non-full groups the user might want to join.
   Score = course alignment + owner-vs-user profile compatibility.
   ───────────────────────────────────────────────────────────────── */
DROP PROCEDURE IF EXISTS GetMatchingGroupsForUser//
CREATE PROCEDURE GetMatchingGroupsForUser(
    IN p_user_id INT,
    IN p_limit   INT
)
BEGIN
    DECLARE v_college_id INT;

    SELECT u.college_id INTO v_college_id
    FROM Users u
    WHERE u.user_id = p_user_id;

    WITH my_profile AS (
        SELECT mp.user_id, mp.study_style, mp.meeting_pref,
               mp.study_goal, mp.focus_time_pref, mp.noise_pref
        FROM Match_Profile mp
        WHERE mp.user_id = p_user_id
    ),
    my_courses AS (
        SELECT course_id
        FROM Match_Profile_Course
        WHERE user_id = p_user_id
    ),
    -- Resolve each group's owner (one row per group).
    group_owners AS (
        SELECT gm.group_id, gm.user_id AS owner_id
        FROM Group_Member gm
        WHERE gm.role = 'owner'
    ),
    candidate_groups AS (
        SELECT
            g.group_id,
            g.group_name,
            g.course_id,
            g.max_members,
            COALESCE(gs.member_count, 0)         AS member_count,
            go.owner_id,
            CONCAT(uo.first_name, ' ', uo.last_name) AS owner_name,
            uo.college_id                         AS owner_college_id,
            mp_o.study_style                      AS owner_study_style,
            mp_o.meeting_pref                     AS owner_meeting_pref,
            mp_o.study_goal                       AS owner_study_goal,
            mp_o.focus_time_pref                  AS owner_focus_time_pref,
            mp_o.noise_pref                       AS owner_noise_pref,
            c.course_code,
            c.course_name,
            -- count courses the user shares with the owner (overlap of
            -- both Match_Profile_Course rosters)
            (
                SELECT COUNT(DISTINCT mpc_o.course_id)
                FROM Match_Profile_Course mpc_o
                JOIN my_courses mc ON mc.course_id = mpc_o.course_id
                WHERE mpc_o.user_id = go.owner_id
            ) AS shared_courses_with_owner,
            -- 1 if user is enrolled in the group's course, else 0
            EXISTS (
                SELECT 1 FROM my_courses mc
                WHERE mc.course_id = g.course_id
            ) AS user_has_group_course
        FROM Study_Group g
        JOIN group_owners go ON go.group_id = g.group_id
        JOIN Users uo ON uo.user_id = go.owner_id
        LEFT JOIN Match_Profile mp_o ON mp_o.user_id = go.owner_id
        LEFT JOIN Group_Summary gs ON gs.group_id = g.group_id
        LEFT JOIN Courses c ON c.course_id = g.course_id
        WHERE g.is_private = FALSE
          AND go.owner_id <> p_user_id
          -- exclude groups the user is already in
          AND NOT EXISTS (
              SELECT 1 FROM Group_Member gm2
              WHERE gm2.group_id = g.group_id
                AND gm2.user_id  = p_user_id
          )
          -- exclude groups with a pending invite to this user
          AND NOT EXISTS (
              SELECT 1 FROM Group_Invite gi
              WHERE gi.group_id = g.group_id
                AND gi.invited_user_id = p_user_id
                AND gi.invite_status = 'pending'
          )
          -- exclude groups with a pending join request from this user
          AND NOT EXISTS (
              SELECT 1 FROM Join_Request jr
              WHERE jr.group_id = g.group_id
                AND jr.user_id  = p_user_id
                AND jr.join_status = 'pending'
          )
          -- exclude full groups
          AND COALESCE(gs.member_count, 0) < g.max_members
    ),
    scored_groups AS (
        SELECT
            cg.*,
            (
                  -- bonus for sharing the group's course (the main signal)
                  CASE WHEN cg.user_has_group_course = 1 THEN 30 ELSE 0 END

                + CASE WHEN cg.owner_college_id = v_college_id THEN 20 ELSE 0 END

                + CASE
                    WHEN mp.study_style IS NULL OR cg.owner_study_style IS NULL THEN 0
                    WHEN mp.study_style = 'no preference' THEN 15
                    WHEN cg.owner_study_style = mp.study_style THEN 15
                    ELSE 0
                  END

                + CASE
                    WHEN mp.meeting_pref IS NULL OR cg.owner_meeting_pref IS NULL THEN 0
                    WHEN mp.meeting_pref = 'no preference' THEN 12
                    WHEN cg.owner_meeting_pref = mp.meeting_pref THEN 12
                    ELSE 0
                  END

                + CASE
                    WHEN mp.study_goal IS NULL OR cg.owner_study_goal IS NULL THEN 0
                    WHEN mp.study_goal = 'all of the above' THEN 8
                    WHEN cg.owner_study_goal = mp.study_goal THEN 8
                    ELSE 0
                  END

                + CASE
                    WHEN mp.focus_time_pref IS NULL OR cg.owner_focus_time_pref IS NULL THEN 0
                    WHEN mp.focus_time_pref = 'no preference' THEN 5
                    WHEN cg.owner_focus_time_pref = mp.focus_time_pref THEN 5
                    ELSE 0
                  END

                + CASE
                    WHEN mp.noise_pref IS NULL OR cg.owner_noise_pref IS NULL THEN 0
                    WHEN mp.noise_pref = 'no preference' THEN 5
                    WHEN cg.owner_noise_pref = mp.noise_pref THEN 5
                    ELSE 0
                  END

                + LEAST(cg.shared_courses_with_owner, 3) * 10
            ) AS match_score
        FROM candidate_groups cg
        LEFT JOIN my_profile mp ON mp.user_id = p_user_id
    )
    SELECT
        sg.group_id,
        sg.group_name,
        sg.course_id,
        sg.course_code,
        sg.course_name,
        sg.max_members,
        sg.member_count,
        sg.owner_id,
        sg.owner_name,
        sg.shared_courses_with_owner,
        sg.user_has_group_course,
        sg.match_score
    FROM scored_groups sg
    -- only show groups the user shares the course with OR matches reasonably well
    WHERE (sg.user_has_group_course = 1 OR sg.match_score >= 40)
    ORDER BY sg.match_score DESC, sg.member_count DESC, sg.group_id
    LIMIT p_limit;
END//


/* ─────────────────────────────────────────────────────────────────
   GetMatchingUsersForGroup
   For an owner viewing their group: rank users worth inviting.
   Verifies caller is the owner.
   ───────────────────────────────────────────────────────────────── */
DROP PROCEDURE IF EXISTS GetMatchingUsersForGroup//
CREATE PROCEDURE GetMatchingUsersForGroup(
    IN p_group_id INT,
    IN p_owner_id INT,
    IN p_limit    INT
)
BEGIN
    DECLARE v_role          VARCHAR(20);
    DECLARE v_group_course  INT;
    DECLARE v_owner_college INT;

    -- caller must be owner
    SELECT role INTO v_role
    FROM Group_Member
    WHERE group_id = p_group_id AND user_id = p_owner_id;

    IF v_role IS NULL OR v_role <> 'owner' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'NOT_OWNER';
    END IF;

    SELECT g.course_id INTO v_group_course
    FROM Study_Group g
    WHERE g.group_id = p_group_id;

    SELECT u.college_id INTO v_owner_college
    FROM Users u
    WHERE u.user_id = p_owner_id;

    WITH owner_profile AS (
        SELECT mp.user_id, mp.study_style, mp.meeting_pref,
               mp.study_goal, mp.focus_time_pref, mp.noise_pref
        FROM Match_Profile mp
        WHERE mp.user_id = p_owner_id
    ),
    owner_courses AS (
        SELECT course_id
        FROM Match_Profile_Course
        WHERE user_id = p_owner_id
    ),
    candidate_users AS (
        SELECT
            u.user_id,
            u.first_name,
            u.last_name,
            u.college_id,
            mp.study_style,
            mp.meeting_pref,
            mp.study_goal,
            mp.focus_time_pref,
            mp.noise_pref,
            mp.age,
            mp.bio,
            mp.profile_image_url,
            -- shared courses with the owner
            (
                SELECT COUNT(DISTINCT mpc.course_id)
                FROM Match_Profile_Course mpc
                JOIN owner_courses oc ON oc.course_id = mpc.course_id
                WHERE mpc.user_id = u.user_id
            ) AS shared_courses_with_owner,
            -- enrolled in the group's course?
            EXISTS (
                SELECT 1 FROM Match_Profile_Course mpc2
                WHERE mpc2.user_id = u.user_id
                  AND mpc2.course_id = v_group_course
            ) AS has_group_course
        FROM Users u
        JOIN Match_Profile mp ON mp.user_id = u.user_id
        WHERE u.user_id <> p_owner_id
          -- not already a member
          AND NOT EXISTS (
              SELECT 1 FROM Group_Member gm
              WHERE gm.group_id = p_group_id
                AND gm.user_id  = u.user_id
          )
          -- no pending invite already
          AND NOT EXISTS (
              SELECT 1 FROM Group_Invite gi
              WHERE gi.group_id = p_group_id
                AND gi.invited_user_id = u.user_id
                AND gi.invite_status = 'pending'
          )
          -- no pending join request from this user
          AND NOT EXISTS (
              SELECT 1 FROM Join_Request jr
              WHERE jr.group_id = p_group_id
                AND jr.user_id  = u.user_id
                AND jr.join_status = 'pending'
          )
    ),
    scored_users AS (
        SELECT
            c.*,
            (
                  CASE WHEN c.has_group_course = 1 THEN 30 ELSE 0 END

                + CASE WHEN c.college_id = v_owner_college THEN 20 ELSE 0 END

                + CASE
                    WHEN op.study_style IS NULL OR c.study_style IS NULL THEN 0
                    WHEN op.study_style = 'no preference' THEN 15
                    WHEN c.study_style = op.study_style THEN 15
                    ELSE 0
                  END

                + CASE
                    WHEN op.meeting_pref IS NULL OR c.meeting_pref IS NULL THEN 0
                    WHEN op.meeting_pref = 'no preference' THEN 12
                    WHEN c.meeting_pref = op.meeting_pref THEN 12
                    ELSE 0
                  END

                + CASE
                    WHEN op.study_goal IS NULL OR c.study_goal IS NULL THEN 0
                    WHEN op.study_goal = 'all of the above' THEN 8
                    WHEN c.study_goal = op.study_goal THEN 8
                    ELSE 0
                  END

                + CASE
                    WHEN op.focus_time_pref IS NULL OR c.focus_time_pref IS NULL THEN 0
                    WHEN op.focus_time_pref = 'no preference' THEN 5
                    WHEN c.focus_time_pref = op.focus_time_pref THEN 5
                    ELSE 0
                  END

                + CASE
                    WHEN op.noise_pref IS NULL OR c.noise_pref IS NULL THEN 0
                    WHEN op.noise_pref = 'no preference' THEN 5
                    WHEN c.noise_pref = op.noise_pref THEN 5
                    ELSE 0
                  END

                + LEAST(c.shared_courses_with_owner, 3) * 10
            ) AS match_score
        FROM candidate_users c
        LEFT JOIN owner_profile op ON op.user_id = p_owner_id
    )
    SELECT
        su.user_id,
        su.first_name,
        su.last_name,
        su.college_id,
        su.study_style,
        su.meeting_pref,
        su.study_goal,
        su.focus_time_pref,
        su.noise_pref,
        su.age,
        su.bio,
        su.profile_image_url,
        su.shared_courses_with_owner,
        su.has_group_course,
        su.match_score
    FROM scored_users su
    WHERE (su.has_group_course = 1 OR su.match_score >= 40)
    ORDER BY su.match_score DESC, su.shared_courses_with_owner DESC, su.user_id
    LIMIT p_limit;
END//


/* ─────────────────────────────────────────────────────────────────
   InviteUserToGroup
   Owner-only. Creates (or refreshes) a Group_Invite row.
   ───────────────────────────────────────────────────────────────── */
DROP PROCEDURE IF EXISTS InviteUserToGroup//
CREATE PROCEDURE InviteUserToGroup(
    IN p_group_id          INT,
    IN p_invited_user_id   INT,
    IN p_owner_id          INT
)
BEGIN
    DECLARE v_role           VARCHAR(20);
    DECLARE v_already_member INT DEFAULT 0;
    DECLARE v_max_members    INT;
    DECLARE v_member_count   INT;
    DECLARE v_existing_status VARCHAR(20);

    IF p_invited_user_id = p_owner_id THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'CANNOT_INVITE_SELF';
    END IF;

    -- caller must be owner
    SELECT role INTO v_role
    FROM Group_Member
    WHERE group_id = p_group_id AND user_id = p_owner_id;

    IF v_role IS NULL OR v_role <> 'owner' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'NOT_OWNER';
    END IF;

    -- group must not be full
    SELECT max_members INTO v_max_members
    FROM Study_Group
    WHERE group_id = p_group_id;

    IF v_max_members IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'GROUP_NOT_FOUND';
    END IF;

    SELECT COUNT(*) INTO v_member_count
    FROM Group_Member
    WHERE group_id = p_group_id;

    IF v_member_count >= v_max_members THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'GROUP_FULL';
    END IF;

    -- already a member?
    SELECT COUNT(*) INTO v_already_member
    FROM Group_Member
    WHERE group_id = p_group_id AND user_id = p_invited_user_id;

    IF v_already_member > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'ALREADY_MEMBER';
    END IF;

    -- existing invite?
    SELECT invite_status INTO v_existing_status
    FROM Group_Invite
    WHERE group_id = p_group_id AND invited_user_id = p_invited_user_id;

    IF v_existing_status = 'pending' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'ALREADY_INVITED';
    END IF;

    -- new invite OR re-invite (after rejection / expiry)
    INSERT INTO Group_Invite (group_id, invited_user_id, invited_by_user_id, invite_status)
    VALUES (p_group_id, p_invited_user_id, p_owner_id, 'pending')
    ON DUPLICATE KEY UPDATE
        invite_status      = 'pending',
        invited_by_user_id = p_owner_id,
        created_at         = CURRENT_TIMESTAMP,
        responded_at       = NULL;

    SELECT LAST_INSERT_ID() AS invite_id;
END//


/* ─────────────────────────────────────────────────────────────────
   RespondToGroupInvite
   The invited user accepts or rejects.
   On accept: also adds them to Group_Member via JoinGroupWithLock.
   ───────────────────────────────────────────────────────────────── */
DROP PROCEDURE IF EXISTS RespondToGroupInvite//
CREATE PROCEDURE RespondToGroupInvite(
    IN p_invite_id INT,
    IN p_user_id   INT,
    IN p_action    VARCHAR(10)
)
BEGIN
    DECLARE v_invited_user INT;
    DECLARE v_group_id     INT;
    DECLARE v_status       VARCHAR(20);
    DECLARE v_new_status   VARCHAR(20);

    SELECT invited_user_id, group_id, invite_status
    INTO v_invited_user, v_group_id, v_status
    FROM Group_Invite
    WHERE invite_id = p_invite_id;

    IF v_invited_user IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'INVITE_NOT_FOUND';
    END IF;

    IF v_invited_user <> p_user_id THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'NOT_YOUR_INVITE';
    END IF;

    IF v_status <> 'pending' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'INVITE_NOT_PENDING';
    END IF;

    IF p_action NOT IN ('accept', 'reject') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'INVALID_ACTION';
    END IF;

    SET v_new_status = CASE
        WHEN p_action = 'accept' THEN 'accepted'
        ELSE 'rejected'
    END;

    -- on accept, add the member first (will SIGNAL if full / already member)
    IF v_new_status = 'accepted' THEN
        CALL JoinGroupWithLock(v_group_id, p_user_id);
    END IF;

    UPDATE Group_Invite
    SET invite_status = v_new_status,
        responded_at  = CURRENT_TIMESTAMP
    WHERE invite_id   = p_invite_id;

    SELECT v_new_status AS invite_status, v_group_id AS group_id;
END//


/* ─────────────────────────────────────────────────────────────────
   GetGroupInvitesForUser
   What groups have invited me?  (Pending only.)
   ───────────────────────────────────────────────────────────────── */
DROP PROCEDURE IF EXISTS GetGroupInvitesForUser//
CREATE PROCEDURE GetGroupInvitesForUser(
    IN p_user_id INT,
    IN p_limit   INT
)
BEGIN
    SELECT
        gi.invite_id,
        gi.group_id,
        g.group_name,
        g.course_id,
        c.course_code,
        c.course_name,
        g.max_members,
        COALESCE(gs.member_count, 0) AS member_count,
        gi.invited_by_user_id,
        CONCAT(u.first_name, ' ', u.last_name) AS invited_by_name,
        gi.created_at
    FROM Group_Invite gi
    JOIN Study_Group g ON g.group_id = gi.group_id
    LEFT JOIN Courses c ON c.course_id = g.course_id
    LEFT JOIN Group_Summary gs ON gs.group_id = g.group_id
    JOIN Users u ON u.user_id = gi.invited_by_user_id
    WHERE gi.invited_user_id = p_user_id
      AND gi.invite_status = 'pending'
    ORDER BY gi.created_at DESC
    LIMIT p_limit;
END//


/* ─────────────────────────────────────────────────────────────────
   GetGroupInvitesSentByGroup
   For owner UI: who have I already invited (any status)?
   ───────────────────────────────────────────────────────────────── */
DROP PROCEDURE IF EXISTS GetGroupInvitesSentByGroup//
CREATE PROCEDURE GetGroupInvitesSentByGroup(
    IN p_group_id INT,
    IN p_owner_id INT
)
BEGIN
    DECLARE v_role VARCHAR(20);

    SELECT role INTO v_role
    FROM Group_Member
    WHERE group_id = p_group_id AND user_id = p_owner_id;

    IF v_role IS NULL OR v_role <> 'owner' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'NOT_OWNER';
    END IF;

    SELECT
        gi.invite_id,
        gi.invited_user_id,
        CONCAT(u.first_name, ' ', u.last_name) AS invited_user_name,
        gi.invite_status,
        gi.created_at,
        gi.responded_at
    FROM Group_Invite gi
    JOIN Users u ON u.user_id = gi.invited_user_id
    WHERE gi.group_id = p_group_id
    ORDER BY gi.created_at DESC;
END//

DELIMITER ;
