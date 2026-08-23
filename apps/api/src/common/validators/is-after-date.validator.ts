import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

/**
 * Ensures a date field is not earlier than another date field on the same DTO.
 * Use: @IsAfterDate('startDate', { message: 'End date must be after start date' })
 */
export function IsAfterDate(
  property: string,
  validationOptions?: ValidationOptions
): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: 'isAfterDate',
      target: object.constructor,
      propertyName: propertyName as string,
      ...(validationOptions ? { options: validationOptions } : {}),
      constraints: [property],
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const other = (args.object as Record<string, unknown>)[
            args.constraints[0] as string
          ];
          if (value == null || other == null) return true; // optional fields
          const date = new Date(value as string);
          const otherDate = new Date(other as string);
          if (Number.isNaN(date.getTime()) || Number.isNaN(otherDate.getTime())) {
            return true; // individual date validity is checked elsewhere
          }
          return date.getTime() >= otherDate.getTime();
        },
        defaultMessage(args: ValidationArguments): string {
          const other = args.constraints[0] as string;
          return `${args.property} must not be earlier than ${other}`;
        },
      },
    });
  };
}
