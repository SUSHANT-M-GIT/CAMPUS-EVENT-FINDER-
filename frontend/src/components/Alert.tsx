interface AlertProps {
  type: "success" | "error";
  message: string;
}

export default function Alert({ type, message }: AlertProps) {
  const classes = type === "success" ? "alert alert-success" : "alert alert-error";

  return <div className={classes}>{message}</div>;
}
