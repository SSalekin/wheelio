# Project Description
This is a mvc for a Random name picker from wheel like (https://wheelofnames.com/), but instead of users creating the wheel manually, the llm will do it for him. User can type in a list of names or just submit an image with the list of names (screenshot), and the app will pick up the list of names from that image. If the image has a list of names, with corresponding id, email etc, then only pick the column the user has mentioned in chat (eg: Pick the names from the list / Pick ids from the list), if not pick just the names

# How it will work

## UI
* UI will be like a generic "chat with llm interface"

## Workflow

#### User passes a list of names (primary requirement)
* User will type in a list of names / ids / emails and ask the chat to create a wheel with those entries
* Instead of the AI answering the user (like how llms feed text to the screen), a wheel will be created and shown to the user consisting names of each student from the image. There should be a button called "Go / Start", clicking it will pick a student name in random.
* There should be a checkbox "Remove the picked students from wheel", if checked and clicked "Go" the entry will be removed from the wheel, if not, the entry will remain in the wheel.
* There should a list of already picked names on the side of the wheel

#### User passes a single image (primary requirement)
* Users will select an image (list of student names, id, email, maybe some other details), ask the chat interface to create a wheel with each student names from that image (read using ocr or pass it to an online tool / agent)
* Instead of the AI answering the user (like how llms feed text to the screen), a wheel will be created and shown to the user consisting names of each student from the image. There should be a button called "Go / Start", clicking it will pick a student name in random.
* There should be a checkbox "Remove the picked students from wheel", if checked and clicked "Go" the entry will be removed from the wheel, if not, the entry will remain in the wheel.
* There should a list of already picked names on the side of the wheel

#### User passess multiple images (secondary requirement, only do if primary ones are done)
* User might not have a list of names, but a list of images (photos / avatars of the students)
* The app will then create a wheel with each images as the entries of the cart.

# Preferred Tech stack
* for now, no need to store anything in the database
* Should use openai, openrouter for agents
* should use langchain, langgraph for orchestration
* because this is a mvc, the UI can be done using streamlit / react and backend done using fastapi, but make sure the animation of the wheel is smooth.

# Next steps
* Plan the project
* Ask atleast 100 questions before to get a clearer idea
* Create a step by step todo list of what features to implement and which to do next
