<?php
/**
 * Database settings and the shop password.
 * The defaults below are the ones XAMPP ships with, so a fresh install works
 * without editing anything. Change the user and password for a real server.
 */
declare(strict_types=1);

const DB_HOST = '127.0.0.1';
const DB_NAME = 'tailor_book';
const DB_USER = 'root';   // XAMPP default
const DB_PASS = '';       // XAMPP default; set this if your MySQL has a password

/**
 * Shared password for this book, asked once per device by the browser.
 * Leave it empty ('') to switch the password off.
 * It only protects anything if the site is served over HTTPS.
 */
const APP_PASSWORD = '';
