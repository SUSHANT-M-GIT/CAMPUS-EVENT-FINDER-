/**
 * paymentController.js
 * Razorpay online payment (primary) + manual UPI screenshot (fallback).
 * Flow:
 *   1. createRazorpayOrder  â†’ backend creates order, returns order_id
 *   2. Frontend opens Razorpay checkout popup
 *   3. Student pays â†’ Razorpay calls verifyRazorpayPayment with signature
 *   4. Backend verifies signature â†’ marks approved â†’ sends QR email
 */
const crypto       = require("crypto");
const QRCode       = require("qrcode");
const Razorpay     = require("razorpay");
const Registration = require("../models/Registration");
const Event        = require("../models/Event");
const User         = require("../models/User");
const { sendEmail } = require("../services/emailService");

// Razorpay instance â€” reads keys from .env at call time
function getRazorpay() {
  return new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

// â”€â”€ Shared helper: approve a registration after payment confirmed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function approveRegistration(reg) {
  reg.paymentStatus = "approved";
  reg.status        = "confirmed";

  // Generate attendance QR
  try {
    const qrData = JSON.stringify({
      registrationId:   reg._id.toString(),
      registrationCode: reg.registrationCode || "",
      eventId:          reg.eventId._id?.toString() || reg.eventId.toString(),
      studentName:      reg.name || reg.userId?.name || "",
    });
    reg.attendanceQr = await QRCode.toDataURL(qrData, { width: 256, margin: 2 });
  } catch (qrErr) {
    console.error("[QR] Generation failed:", qrErr.message);
  }

  await reg.save();
  await Event.findByIdAndUpdate(reg.eventId._id || reg.eventId, { $inc: { registrationCount: 1 } });

  // Socket notification
  if (global.io) {
    global.io.to(reg.userId._id?.toString() || reg.userId.toString()).emit("paymentApproved", {
      registrationId: reg._id,
      eventTitle:     reg.eventId?.title,
      message:        `Payment confirmed for "${reg.eventId?.title}". You're registered!`,
    });
  }

  // Confirmation email with QR
  const email   = reg.userId?.email;
  const name    = reg.userId?.name || "there";
  const regCode = reg.registrationCode || "";
  const qrSection = reg.attendanceQr
    ? `<div style="text-align:center;margin:20px 0;padding:20px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
        <p style="margin:0 0 12px;font-weight:700;color:#1e293b;">Your Attendance QR Code</p>
        <img src="${reg.attendanceQr}" alt="QR" style="width:180px;height:180px;border-radius:8px;border:1px solid #e2e8f0;" />
        <p style="margin:12px 0 4px;font-size:0.85rem;color:#64748b;">Show this QR at the venue for attendance.</p>
        ${regCode ? `<div style="display:inline-block;background:#4f46e5;color:#fff;padding:8px 20px;border-radius:99px;font-family:monospace;font-size:1.1rem;font-weight:800;letter-spacing:0.1em;margin-top:8px;">${regCode}</div>
        <p style="margin:6px 0 0;font-size:0.78rem;color:#94a3b8;">Use this code for manual attendance if QR scan fails.</p>` : ""}
      </div>` : "";

  if (email) {
    sendEmail({
      to: email,
      subject: `Payment Confirmed: ${reg.eventId?.title}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;">
  <div style="background:#059669;padding:20px 24px;color:#fff;"><h2 style="margin:0;">Payment Confirmed!</h2></div>
  <div style="padding:24px;">
    <p>Hi <strong>${name}</strong>,</p>
    <p>Your payment for <strong>${reg.eventId?.title}</strong> is confirmed. You are registered!</p>
    ${qrSection}
    <p>See you at the event!</p>
    <p style="color:#888;font-size:0.8rem;margin-top:24px;">Campus Event Finder</p>
  </div>
</div>`,
    }).catch(err => console.error("[Email] Payment confirm:", err.message));
  }
}

// â”€â”€ CREATE RAZORPAY ORDER (student) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// POST /api/payment/create-order/:registrationId
exports.createRazorpayOrder = async (req, res) => {
  try {
    const reg = await Registration.findById(req.params.registrationId)
      .populate("eventId")
      .populate("userId", "name email");

    if (!reg) return res.status(404).json({ msg: "Registration not found" });
    if (reg.userId._id?.toString() !== req.user.id && reg.userId.toString() !== req.user.id)
      return res.status(403).json({ msg: "Access denied" });
    if (reg.paymentStatus === "approved")
      return res.status(400).json({ msg: "Payment already approved" });

    const event = reg.eventId;
    if (!event?.isPaid || !event?.price)
      return res.status(400).json({ msg: "This is not a paid event" });

    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount:   Math.round(event.price * 100), // paise
      currency: "INR",
      receipt:  `reg_${reg._id.toString().slice(-8)}`,
      notes: {
        registrationId: reg._id.toString(),
        eventTitle:     event.title,
        studentName:    reg.userId?.name || reg.name || "",
      },
    });

    // Save order id for verification later
    reg.razorpayOrderId = order.id;
    await reg.save();

    res.json({
      orderId:    order.id,
      amount:     order.amount,
      currency:   order.currency,
      keyId:      process.env.RAZORPAY_KEY_ID,
      eventTitle: event.title,
      studentName: reg.userId?.name || reg.name || "",
      studentEmail: reg.userId?.email || "",
    });
  } catch (e) {
    console.error("createRazorpayOrder error:", e.message);
    res.status(500).json({ msg: e.message });
  }
};

// â”€â”€ VERIFY RAZORPAY PAYMENT (student, called after checkout success) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// POST /api/payment/verify/:registrationId
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
exports.verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
      return res.status(400).json({ msg: "Missing payment details" });

    // Verify signature: HMAC-SHA256 of "order_id|payment_id" with key_secret
    const expectedSig = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSig !== razorpay_signature)
      return res.status(400).json({ msg: "Payment verification failed. Invalid signature." });

    // Find registration by order id
    const reg = await Registration.findOne({ razorpayOrderId: razorpay_order_id })
      .populate("eventId")
      .populate("userId", "name email");

    if (!reg) return res.status(404).json({ msg: "Registration not found" });
    if (reg.paymentStatus === "approved")
      return res.json({ msg: "Payment already confirmed." });

    // Save payment details
    reg.razorpayPaymentId = razorpay_payment_id;
    reg.razorpaySignature = razorpay_signature;
    reg.transactionId     = razorpay_payment_id;

    await approveRegistration(reg);

    res.json({ msg: "Payment verified! You are now registered.", registrationId: reg._id });
  } catch (e) {
    console.error("verifyRazorpayPayment error:", e.message);
    res.status(500).json({ msg: e.message });
  }
};

// â”€â”€ SUBMIT MANUAL PAYMENT (student â€” fallback if Razorpay fails) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// POST /api/payment/submit/:registrationId
exports.submitPayment = async (req, res) => {
  try {
    const reg = await Registration.findById(req.params.registrationId);
    if (!reg) return res.status(404).json({ msg: "Registration not found" });
    if (reg.userId.toString() !== req.user.id)
      return res.status(403).json({ msg: "Access denied" });
    if (reg.paymentStatus === "approved")
      return res.status(400).json({ msg: "Payment already approved" });

    const { transactionId } = req.body;
    if (!transactionId?.trim())
      return res.status(400).json({ msg: "Transaction ID is required" });
    if (!req.file)
      return res.status(400).json({ msg: "Payment screenshot is required" });

    reg.transactionId     = transactionId.trim();
    reg.paymentScreenshot = `/uploads/payment-screenshots/${req.file.filename}`;
    reg.paymentStatus     = "pending";
    await reg.save();

    if (global.io) {
      const event   = await Event.findById(reg.eventId).lean();
      const student = await User.findById(reg.userId, "name email").lean();
      global.io.to("admins").emit("paymentSubmitted", {
        registrationId: reg._id,
        studentName:    student?.name,
        eventTitle:     event?.title,
        transactionId:  reg.transactionId,
      });
    }

    res.json({ msg: "Payment submitted. Awaiting admin verification." });
  } catch (e) {
    console.error("submitPayment error:", e.message);
    res.status(500).json({ msg: e.message });
  }
};

// â”€â”€ GET PENDING PAYMENTS (admin) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.getPendingPayments = async (req, res) => {
  try {
    const regs = await Registration.find({ paymentStatus: "pending" })
      .populate("userId",  "name email collegeName")
      .populate("eventId", "title date price upiId")
      .sort({ registeredAt: -1 })
      .lean();
    res.json(regs);
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
};

// â”€â”€ APPROVE MANUAL PAYMENT (admin) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.approvePayment = async (req, res) => {
  try {
    const reg = await Registration.findById(req.params.registrationId)
      .populate("eventId")
      .populate("userId", "name email");
    if (!reg) return res.status(404).json({ msg: "Registration not found" });
    if (reg.paymentStatus !== "pending")
      return res.status(400).json({ msg: `Payment is already ${reg.paymentStatus}` });

    await approveRegistration(reg);
    res.json({ msg: "Payment approved. Student has been notified." });
  } catch (e) {
    console.error("approvePayment error:", e.message);
    res.status(500).json({ msg: e.message });
  }
};

// â”€â”€ REJECT MANUAL PAYMENT (admin) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.rejectPayment = async (req, res) => {
  try {
    const reg = await Registration.findById(req.params.registrationId)
      .populate("eventId")
      .populate("userId", "name email");
    if (!reg) return res.status(404).json({ msg: "Registration not found" });
    if (reg.paymentStatus !== "pending")
      return res.status(400).json({ msg: `Payment is already ${reg.paymentStatus}` });

    const reason = req.body?.reason?.trim() || "";
    reg.paymentStatus = "rejected";
    reg.paymentNote   = reason;
    await reg.save();

    if (global.io) {
      global.io.to(reg.userId._id?.toString() || reg.userId.toString()).emit("paymentRejected", {
        registrationId: reg._id,
        eventTitle:     reg.eventId?.title,
        reason,
        message: `Payment verification failed for "${reg.eventId?.title}". Please try again.`,
      });
    }

    const email = reg.userId?.email;
    const name  = reg.userId?.name || "there";
    if (email) {
      sendEmail({
        to: email,
        subject: `Payment Not Verified: ${reg.eventId?.title}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;">
  <div style="background:#dc2626;padding:20px 24px;color:#fff;"><h2 style="margin:0;">Payment Not Verified</h2></div>
  <div style="padding:24px;">
    <p>Hi <strong>${name}</strong>,</p>
    <p>Your payment for <strong>${reg.eventId?.title}</strong> could not be verified.</p>
    ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
    <p style="color:#888;font-size:0.8rem;margin-top:24px;">Campus Event Finder</p>
  </div>
</div>`,
      }).catch(() => {});
    }
    res.json({ msg: "Payment rejected. Student has been notified." });
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
};

// â”€â”€ GET MY PAYMENT STATUS (student) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.getMyPaymentStatus = async (req, res) => {
  try {
    const reg = await Registration.findOne({ userId: req.user.id, eventId: req.params.eventId }).lean();
    if (!reg) return res.status(404).json({ msg: "No registration found" });
    res.json({
      paymentStatus:     reg.paymentStatus,
      transactionId:     reg.transactionId,
      paymentScreenshot: reg.paymentScreenshot,
      paymentNote:       reg.paymentNote,
    });
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
};

// â”€â”€ REQUEST REFUND (student) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.requestRefund = async (req, res) => {
  try {
    const reg = await Registration.findById(req.params.registrationId)
      .populate("eventId")
      .populate("userId", "name email");
    if (!reg) return res.status(404).json({ msg: "Registration not found" });
    if (reg.userId._id?.toString() !== req.user.id && reg.userId.toString() !== req.user.id)
      return res.status(403).json({ msg: "Access denied" });
    if (reg.paymentStatus !== "approved")
      return res.status(400).json({ msg: "Refund only available for approved payments" });
    if (reg.refundStatus !== "none")
      return res.status(400).json({ msg: `Refund already ${reg.refundStatus}` });

    const event = reg.eventId;
    if (!event?.refundAllowed)
      return res.status(400).json({ msg: "This event does not support refunds" });

    const eventDate  = new Date(event.date);
    const cutoffMs   = (event.refundCutoffHours || 48) * 60 * 60 * 1000;
    const cutoffDate = new Date(eventDate.getTime() - cutoffMs);
    if (new Date() > cutoffDate)
      return res.status(400).json({ msg: `Refund period expired. Must request at least ${event.refundCutoffHours}h before event.` });

    const refundAmt = Math.round((event.price || 0) * (event.refundPercentage || 100) / 100);
    reg.refundStatus = "requested";
    reg.refundAmount = refundAmt;
    await reg.save();

    if (global.io) {
      global.io.to("admins").emit("refundRequested", {
        registrationId: reg._id,
        eventTitle:     event.title,
        refundAmount:   refundAmt,
      });
    }
    res.json({ msg: `Refund of Rs.${refundAmt} requested. Admin will review shortly.`, refundAmount: refundAmt });
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
};

// â”€â”€ APPROVE REFUND (admin) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.approveRefund = async (req, res) => {
  try {
    const reg = await Registration.findById(req.params.registrationId)
      .populate("eventId").populate("userId", "name email");
    if (!reg) return res.status(404).json({ msg: "Registration not found" });
    if (reg.refundStatus !== "requested") return res.status(400).json({ msg: "No pending refund" });

    reg.refundStatus  = "approved";
    reg.paymentStatus = "rejected";
    reg.status        = "waitlisted";
    await reg.save();
    await Event.findByIdAndUpdate(reg.eventId._id || reg.eventId, { $inc: { registrationCount: -1 } });

    const email = reg.userId?.email;
    const name  = reg.userId?.name || "there";
    if (email) {
      sendEmail({
        to: email,
        subject: `Refund Approved: ${reg.eventId?.title}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;">
  <div style="background:#059669;padding:20px 24px;color:#fff;"><h2 style="margin:0;">Refund Approved!</h2></div>
  <div style="padding:24px;">
    <p>Hi <strong>${name}</strong>, your refund of <strong>Rs.${reg.refundAmount}</strong> for <strong>${reg.eventId?.title}</strong> is approved.</p>
    <p>Amount will be credited within 5-7 business days.</p>
    <p style="color:#888;font-size:0.8rem;margin-top:24px;">Campus Event Finder</p>
  </div>
</div>`,
      }).catch(() => {});
    }

    if (global.io) {
      global.io.to(reg.userId._id?.toString() || reg.userId.toString()).emit("refundApproved", {
        registrationId: reg._id, eventTitle: reg.eventId?.title, refundAmount: reg.refundAmount,
      });
    }
    res.json({ msg: "Refund approved. Student notified." });
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
};

// â”€â”€ REJECT REFUND (admin) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.rejectRefund = async (req, res) => {
  try {
    const reg = await Registration.findById(req.params.registrationId)
      .populate("eventId").populate("userId", "name email");
    if (!reg) return res.status(404).json({ msg: "Registration not found" });
    if (reg.refundStatus !== "requested") return res.status(400).json({ msg: "No pending refund" });

    const reason = req.body?.reason?.trim() || "";
    reg.refundStatus = "rejected";
    reg.refundNote   = reason;
    await reg.save();

    const email = reg.userId?.email;
    const name  = reg.userId?.name || "there";
    if (email) {
      sendEmail({
        to: email,
        subject: `Refund Rejected: ${reg.eventId?.title}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;">
  <div style="background:#dc2626;padding:20px 24px;color:#fff;"><h2 style="margin:0;">Refund Not Approved</h2></div>
  <div style="padding:24px;">
    <p>Hi <strong>${name}</strong>, your refund for <strong>${reg.eventId?.title}</strong> was not approved.</p>
    ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
    <p style="color:#888;font-size:0.8rem;margin-top:24px;">Campus Event Finder</p>
  </div>
</div>`,
      }).catch(() => {});
    }
    res.json({ msg: "Refund rejected. Student notified." });
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
};

// â”€â”€ GET PENDING REFUNDS (admin) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.getPendingRefunds = async (req, res) => {
  try {
    const regs = await Registration.find({ refundStatus: "requested" })
      .populate("userId",  "name email collegeName")
      .populate("eventId", "title date price refundPercentage")
      .sort({ registeredAt: -1 })
      .lean();
    res.json(regs);
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
};

