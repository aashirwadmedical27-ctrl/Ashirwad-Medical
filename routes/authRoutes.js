const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const User = require("../models/User");
const { verifyGoogleToken } = require("../config/googleAuth");

const router = express.Router();


// =====================================================
// JWT TOKEN
// =====================================================

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role || "user",
    },
    process.env.JWT_SECRET || "change_me",
    {
      expiresIn: "7d",
    }
  );
};

const serializeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone || "",
  gender: user.gender || "",
  dateOfBirth: user.dateOfBirth
    ? new Date(user.dateOfBirth).toISOString()
    : "",
  role: user.role || "user",
  picture: user.picture || "",
});


// =====================================================
// NORMAL SIGNUP
// =====================================================

router.post("/signup", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      dateOfBirth,
      gender,
    } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        message: "Name, email, phone and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();

    const existingUser = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { phone: normalizedPhone },
      ],
    });

    if (existingUser) {
      return res.status(409).json({
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      password: hashedPassword,
      dateOfBirth,
      gender,
      role: "user",
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully",

      token: generateToken(user),

      user: serializeUser(user),
    });

  } catch (error) {
    console.error("Signup error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Signup failed",
    });
  }
});


// =====================================================
// NORMAL EMAIL / PHONE LOGIN
// =====================================================

router.post("/login", async (req, res) => {
  try {
    const {
      email,
      phone,
      password,
    } = req.body;

    const loginField = email || phone;

    if (!loginField || !password) {
      return res.status(400).json({
        message: "Email/phone and password are required",
      });
    }

    const trimmedLoginField = loginField.trim();

    const user = await User.findOne({
      $or: [
        { email: trimmedLoginField.toLowerCase() },
        { phone: trimmedLoginField },
      ],
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Google-only account
    if (!user.password) {
      return res.status(400).json({
        message:
          "This account was created using Google. Please use Google Login.",
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    return res.json({
      success: true,
      message: "Login successful",

      token: generateToken(user),

      user: serializeUser(user),
    });

  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Login failed",
    });
  }
});


// =====================================================
// GOOGLE LOGIN
// =====================================================

router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: "Google credential is required",
      });
    }

    // -------------------------------------------------
    // Verify Google ID token
    // -------------------------------------------------

    const googleUser = await verifyGoogleToken(credential);

    const {
      sub: googleId,
      email,
      name,
      picture,
      email_verified,
    } = googleUser;

    if (!email) {
      return res.status(400).json({
        success: false,
        message:
          "Google account does not contain an email address",
      });
    }

    if (!email_verified) {
      return res.status(401).json({
        success: false,
        message: "Google email is not verified",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // -------------------------------------------------
    // Find existing user
    // -------------------------------------------------

    let user = await User.findOne({
      email: normalizedEmail,
    });

    // -------------------------------------------------
    // Existing user
    // -------------------------------------------------

    if (user) {

      // If the existing account doesn't have Google ID,
      // connect this Google account to the existing account.
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }

      // If the Google ID exists but doesn't match,
      // don't connect another Google account to it.
      else if (user.googleId !== googleId) {
        return res.status(409).json({
          success: false,
          message:
            "This email is already connected to another Google account.",
        });
      }
    }

    // -------------------------------------------------
    // New Google user
    // -------------------------------------------------

    else {

      /*
       * Google does not provide:
       * - phone
       * - password
       *
       * Therefore, we don't store either of them.
       *
       * Your User schema already has:
       *
       * password: required: false
       *
       * phone: required: false, sparse: true
       */

      user = await User.create({
        name: name || "Google User",

        email: normalizedEmail,

        googleId: googleId,

        role: "user",
      });
    }

    // -------------------------------------------------
    // Generate YOUR application's JWT
    // -------------------------------------------------

    const token = generateToken(user);

    // -------------------------------------------------
    // Send response
    // -------------------------------------------------

    return res.status(200).json({
      success: true,
      message: "Google login successful",

      token,

      user: {
        ...serializeUser(user),
        picture: picture || user.picture || "",
      },
    });

  } catch (error) {

    console.error(
      "Google authentication error:",
      error
    );

    return res.status(401).json({
      success: false,
      message:
        error.message || "Google authentication failed",
    });
  }
});


// =====================================================
// FORGOT PASSWORD
// =====================================================

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    /*
     * Don't reveal whether an email exists.
     * This is better for security.
     */
    if (!user) {
      return res.json({
        success: true,
        message:
          "If an account exists with this email, a password reset link has been sent.",
      });
    }

    // Google-only account
    if (!user.password && user.googleId) {
      return res.status(400).json({
        success: false,
        message:
          "This account uses Google Login. Please continue with Google.",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    user.resetPasswordToken = resetToken;

    // Token valid for 15 minutes
    user.resetPasswordExpires =
      new Date(Date.now() + 15 * 60 * 1000);

    await user.save();

    /*
     * IMPORTANT:
     *
     * Your email sending code should send a link containing:
     *
     * http://localhost:5173/reset-password/<resetToken>
     *
     * This route only generates and stores the token.
     *
     * If you already have your email service configured,
     * call it here.
     */

    console.log(
      "Password reset token generated:",
      resetToken
    );

    return res.json({
      success: true,
      message:
        "If an account exists with this email, a password reset link has been sent.",
    });

  } catch (error) {
    console.error(
      "Forgot password error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message || "Failed to process forgot password request",
    });
  }
});


// =====================================================
// RESET PASSWORD
// =====================================================

router.post("/reset-password", async (req, res) => {
  try {
    const {
      token,
      password,
      confirmPassword,
    } = req.body;

    if (!token || !password || !confirmPassword) {
      return res.status(400).json({
        message:
          "Token, password and confirm password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message:
          "Password must be at least 6 characters long",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match",
      });
    }

    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: {
        $gt: new Date(),
      },
    });

    if (!user) {
      return res.status(400).json({
        message:
          "Reset link is invalid or has expired",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    user.password = hashedPassword;

    // Remove reset token after successful reset
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    await user.save();

    return res.json({
      success: true,
      message:
        "Password reset successfully",
    });

  } catch (error) {
    console.error(
      "Reset password error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message || "Failed to reset password",
    });
  }
});


module.exports = router;