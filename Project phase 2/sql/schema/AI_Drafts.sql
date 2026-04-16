USE StudyBuddy;

CREATE TABLE IF NOT EXISTS ai_draft_set (
    draft_set_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    course_id INT NOT NULL,
    source_type VARCHAR(50) NOT NULL DEFAULT 'notes',
    source_text MEDIUMTEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ai_draft_set_user
        FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT fk_ai_draft_set_course
        FOREIGN KEY (course_id) REFERENCES courses(course_id)
);

CREATE TABLE IF NOT EXISTS ai_draft_flashcard (
    draft_flashcard_id INT AUTO_INCREMENT PRIMARY KEY,
    draft_set_id INT NOT NULL,
    front_text TEXT NOT NULL,
    back_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ai_draft_flashcard_set
        FOREIGN KEY (draft_set_id) REFERENCES ai_draft_set(draft_set_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_draft_question (
    draft_question_id INT AUTO_INCREMENT PRIMARY KEY,
    draft_set_id INT NOT NULL,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL DEFAULT 'multiple_choice',
    points INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ai_draft_question_set
        FOREIGN KEY (draft_set_id) REFERENCES ai_draft_set(draft_set_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_draft_answer (
    draft_answer_id INT AUTO_INCREMENT PRIMARY KEY,
    draft_question_id INT NOT NULL,
    answer_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ai_draft_answer_question
        FOREIGN KEY (draft_question_id) REFERENCES ai_draft_question(draft_question_id)
        ON DELETE CASCADE
);